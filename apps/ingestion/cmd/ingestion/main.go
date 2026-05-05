// Package main is the entrypoint for the ingestion worker.
//
// Pipeline:
//
//	[ sources ]  ──►  bounded chan  ──►  [ FanOut sinks ]
//	  iett                                    ├─ redis (latest-vehicle hash)
//	  ego                                     ├─ mqtt  (positions/{city}/{route})
//	  …                                       ├─ timescale (history hypertable)
//	                                          └─ log   (debug, dev only)
//
// Drop-oldest backpressure on each sink ensures slow downstreams never stall
// the upstream sources. Latest-wins is the correct semantics for live state.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/app-bus/ingestion/internal/config"
	"github.com/app-bus/ingestion/internal/health"
	"github.com/app-bus/ingestion/internal/metrics"
	"github.com/app-bus/ingestion/internal/sink"
	"github.com/app-bus/ingestion/internal/source"
	"github.com/app-bus/ingestion/internal/types"
)

const (
	shutdownTimeout = 15 * time.Second
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("config load failed", "err", err)
		os.Exit(1)
	}

	logger := newLogger(cfg)
	slog.SetDefault(logger)
	logger.Info("ingestion worker starting", "config", cfg.String())

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// ── HTTP servers (health + metrics) ────────────────────────────────────
	healthSrv := &http.Server{
		Addr:              cfg.HealthAddr,
		Handler:           health.NewMux(cfg.ServiceVersion),
		ReadHeaderTimeout: 5 * time.Second,
	}
	metricsSrv := &http.Server{
		Addr:              cfg.MetricsAddr,
		Handler:           metricsMux(),
		ReadHeaderTimeout: 5 * time.Second,
	}
	go runHTTP(healthSrv, "health", logger, stop)
	go runHTTP(metricsSrv, "metrics", logger, stop)

	// ── Sinks ──────────────────────────────────────────────────────────────
	sinks := buildSinks(ctx, cfg, logger)
	fanOut := sink.NewFanOut(logger, sinks...)

	// ── Pipeline channel ───────────────────────────────────────────────────
	pipeline := make(chan types.Position, 4096)

	// Wrapper that records metrics on the way through
	wrapped := make(chan types.Position, 4096)
	go func() {
		defer close(pipeline)
		for p := range wrapped {
			metrics.PositionsReceived.WithLabelValues(p.OperatorCode).Inc()
			metrics.SourceLagSeconds.WithLabelValues(p.OperatorCode).Observe(float64(p.SourceLagMs) / 1000)
			pipeline <- p
		}
	}()

	go fanOut.Run(ctx, pipeline)

	// ── Sources ────────────────────────────────────────────────────────────
	sources := buildSources(cfg, logger)
	for _, s := range sources {
		go func(s source.Source) {
			err := s.Run(ctx, wrapped)
			if err != nil && !errors.Is(err, context.Canceled) {
				logger.Error("source exited with error", "source", s.Name(), "err", err)
			}
		}(s)
	}

	// ── Wait for shutdown ──────────────────────────────────────────────────
	<-ctx.Done()
	logger.Info("shutdown signal received, draining…")
	close(wrapped)

	shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()
	_ = healthSrv.Shutdown(shutdownCtx)
	_ = metricsSrv.Shutdown(shutdownCtx)
	fanOut.Close(shutdownCtx)

	logger.Info("bye")
}

func newLogger(cfg config.Config) *slog.Logger {
	level := slog.LevelInfo
	switch cfg.LogLevel {
	case "debug":
		level = slog.LevelDebug
	case "warn":
		level = slog.LevelWarn
	case "error":
		level = slog.LevelError
	}

	if cfg.Env == "development" {
		return slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: level}))
	}
	return slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: level})).
		With("service", "ingestion", "version", cfg.ServiceVersion)
}

func metricsMux() http.Handler {
	mux := http.NewServeMux()
	mux.Handle("/metrics", metrics.Handler())
	return mux
}

func runHTTP(srv *http.Server, name string, logger *slog.Logger, stop func()) {
	logger.Info("http server listening", "name", name, "addr", srv.Addr)
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		logger.Error("http server error", "name", name, "err", err)
		stop()
	}
}

func buildSources(cfg config.Config, logger *slog.Logger) []source.Source {
	out := []source.Source{}
	if cfg.IettURL != "" {
		out = append(out, source.NewIettSource(source.IettConfig{
			URL: cfg.IettURL, IntervalSec: cfg.IettIntervalSec, Logger: logger.With("source", "iett"),
		}))
	}
	if cfg.EgoURL != "" {
		out = append(out, source.NewEgoSource(source.EgoConfig{
			URL: cfg.EgoURL, IntervalSec: cfg.EgoIntervalSec, Logger: logger.With("source", "ego"),
		}))
	}
	return out
}

func buildSinks(ctx context.Context, cfg config.Config, logger *slog.Logger) []sink.Sink {
	sinks := []sink.Sink{}
	if cfg.RedisURL != "" {
		s, err := sink.NewRedisSink(cfg.RedisURL, logger.With("sink", "redis"))
		if err != nil {
			logger.Error("redis sink init failed", "err", err)
		} else {
			sinks = append(sinks, &countingSink{Sink: s, name: "redis"})
		}
	}
	if cfg.MQTTURL != "" {
		s, err := sink.NewMqttSink(cfg.MQTTURL, cfg.MQTTClientID, logger.With("sink", "mqtt"))
		if err != nil {
			logger.Error("mqtt sink init failed", "err", err)
		} else {
			sinks = append(sinks, &countingSink{Sink: s, name: "mqtt"})
		}
	}
	if cfg.TimescaleDSN != "" {
		s, err := sink.NewTimescaleSink(ctx, cfg.TimescaleDSN, logger.With("sink", "timescale"))
		if err != nil {
			logger.Error("timescale sink init failed", "err", err)
		} else {
			sinks = append(sinks, &countingSink{Sink: s, name: "timescale"})
		}
	}
	if len(sinks) == 0 {
		// Dev fallback: visible signal that the pipeline is alive without infra.
		sinks = append(sinks, &countingSink{Sink: sink.NewLogSink(logger.With("sink", "log"), 50), name: "log"})
	}
	return sinks
}

// countingSink wraps any sink with positions_published_total + sink_errors_total counters.
type countingSink struct {
	sink.Sink
	name string
	sent atomic.Uint64
}

func (c *countingSink) Send(ctx context.Context, p types.Position) {
	c.Sink.Send(ctx, p)
	c.sent.Add(1)
	metrics.PositionsPublished.WithLabelValues(c.name).Inc()
}
