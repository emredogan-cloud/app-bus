package sink

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/app-bus/ingestion/internal/types"
)

// TimescaleSink batches positions and inserts via COPY for throughput.
// Flush triggers: every 5s OR when buffer hits 1000 records, whichever first.
type TimescaleSink struct {
	pool      *pgxpool.Pool
	logger    *slog.Logger
	mu        sync.Mutex
	buf       []types.Position
	flushSize int
	flushTick *time.Ticker
	closed    chan struct{}
}

func NewTimescaleSink(ctx context.Context, dsn string, logger *slog.Logger) (*TimescaleSink, error) {
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	s := &TimescaleSink{
		pool:      pool,
		logger:    logger,
		flushSize: 1000,
		flushTick: time.NewTicker(5 * time.Second),
		closed:    make(chan struct{}),
	}
	go s.flushLoop()
	return s, nil
}

func (*TimescaleSink) Name() string { return "timescale" }

func (s *TimescaleSink) Send(_ context.Context, p types.Position) {
	s.mu.Lock()
	s.buf = append(s.buf, p)
	shouldFlush := len(s.buf) >= s.flushSize
	s.mu.Unlock()
	if shouldFlush {
		s.flush(context.Background())
	}
}

func (s *TimescaleSink) flushLoop() {
	for {
		select {
		case <-s.closed:
			return
		case <-s.flushTick.C:
			s.flush(context.Background())
		}
	}
}

func (s *TimescaleSink) flush(ctx context.Context) {
	s.mu.Lock()
	if len(s.buf) == 0 {
		s.mu.Unlock()
		return
	}
	batch := s.buf
	s.buf = nil
	s.mu.Unlock()

	rows := make([][]any, 0, len(batch))
	for _, p := range batch {
		rows = append(rows, []any{
			p.RecordedAt,
			p.VehicleID,
			nilIfEmpty(p.RouteID),
			nilIfEmpty(p.OperatorCode), // operator_id resolution happens API-side
			p.Lat,
			p.Lng,
			p.SpeedKmh,
			p.Heading,
			p.SourceLagMs,
		})
	}

	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	_, err := s.pool.CopyFrom(
		ctx,
		[]string{"vehicle_positions"},
		[]string{"time", "vehicle_id", "route_id", "operator_id", "lat", "lng", "speed_kmh", "heading", "source_lag_ms"},
		copyRows(rows),
	)
	if err != nil {
		s.logger.Warn("timescale copy failed", "err", err, "batch_size", len(batch))
	}
}

func (s *TimescaleSink) Close(ctx context.Context) error {
	s.flushTick.Stop()
	close(s.closed)
	s.flush(ctx)
	s.pool.Close()
	return nil
}

func nilIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}

// copyRows is a tiny adapter so we can pgxpool.CopyFrom from a [][]any without
// pulling in the pgx CopyFromSlice helper variants.
type copyRowsImpl struct {
	rows [][]any
	idx  int
}

func copyRows(rows [][]any) *copyRowsImpl { return &copyRowsImpl{rows: rows} }

func (c *copyRowsImpl) Next() bool { return c.idx < len(c.rows) }
func (c *copyRowsImpl) Values() ([]any, error) {
	r := c.rows[c.idx]
	c.idx++
	return r, nil
}
func (*copyRowsImpl) Err() error { return nil }
