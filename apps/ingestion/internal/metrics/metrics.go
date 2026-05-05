// Package metrics provides Prometheus counters/histograms for the ingestion worker.
package metrics

import (
	"net/http"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	PositionsReceived = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "positions_received_total",
		Help: "Positions received per source.",
	}, []string{"source"})

	PositionsPublished = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "positions_published_total",
		Help: "Positions published per sink.",
	}, []string{"sink"})

	SourceLagSeconds = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "source_lag_seconds",
		Help:    "Lag from source-recorded-at to ingestion timestamp.",
		Buckets: []float64{0.1, 0.5, 1, 2, 5, 10, 30, 60, 120},
	}, []string{"source"})

	SinkErrors = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "sink_errors_total",
		Help: "Sink write errors.",
	}, []string{"sink"})
)

func init() {
	prometheus.MustRegister(PositionsReceived, PositionsPublished, SourceLagSeconds, SinkErrors)
}

// Handler returns the /metrics http.Handler.
func Handler() http.Handler { return promhttp.Handler() }
