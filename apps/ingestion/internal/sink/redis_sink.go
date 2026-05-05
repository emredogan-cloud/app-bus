package sink

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/app-bus/ingestion/internal/types"
)

// RedisSink writes each Position into the hash
//   vehicles:{city}:{route_id}
// keyed by vehicle_id with an EXPIRE of 90s so disappeared vehicles age out.
//
// Using HSET + EXPIRE per position is the simplest correct shape; on machines
// where bandwidth matters we batch into a Pipelined() round-trip.
type RedisSink struct {
	client *redis.Client
	logger *slog.Logger
	ttl    time.Duration
}

func NewRedisSink(url string, logger *slog.Logger) (*RedisSink, error) {
	opt, err := redis.ParseURL(url)
	if err != nil {
		return nil, err
	}
	return &RedisSink{
		client: redis.NewClient(opt),
		logger: logger,
		ttl:    90 * time.Second,
	}, nil
}

func (*RedisSink) Name() string { return "redis" }

func (s *RedisSink) Send(ctx context.Context, p types.Position) {
	if p.RouteExternalID == "" {
		return
	}
	key := "vehicles:" + p.CityCode + ":" + p.RouteExternalID
	body, err := json.Marshal(p)
	if err != nil {
		s.logger.Warn("redis sink marshal failed", "err", err)
		return
	}

	pipe := s.client.Pipeline()
	pipe.HSet(ctx, key, p.VehicleID, body)
	pipe.Expire(ctx, key, s.ttl)
	if _, err := pipe.Exec(ctx); err != nil {
		s.logger.Warn("redis sink write failed", "err", err)
	}
}

func (s *RedisSink) Close(_ context.Context) error {
	return s.client.Close()
}
