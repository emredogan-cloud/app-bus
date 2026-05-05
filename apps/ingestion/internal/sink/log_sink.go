package sink

import (
	"context"
	"log/slog"
	"sync/atomic"
	"time"

	"github.com/app-bus/ingestion/internal/types"
)

// LogSink is a debug sink that prints every Nth position to stderr. Useful for
// local dev when Redis/MQTT/Timescale aren't running yet.
type LogSink struct {
	logger *slog.Logger
	count  atomic.Uint64
	every  uint64
	last   atomic.Int64 // unix-nano of last log
}

func NewLogSink(logger *slog.Logger, every uint64) *LogSink {
	if every == 0 {
		every = 100
	}
	return &LogSink{logger: logger, every: every}
}

func (s *LogSink) Name() string { return "log" }

func (s *LogSink) Send(_ context.Context, p types.Position) {
	n := s.count.Add(1)
	if n%s.every == 0 {
		s.logger.Info("position",
			"vehicle", p.VehicleID,
			"route", p.RouteExternalID,
			"city", p.CityCode,
			"lat", p.Lat,
			"lng", p.Lng,
			"speed_kmh", p.SpeedKmh,
			"lag_ms", p.SourceLagMs,
		)
		s.last.Store(time.Now().UnixNano())
	}
}

func (*LogSink) Close(_ context.Context) error { return nil }
