package source

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/app-bus/ingestion/internal/types"
)

// EgoSource — same shape as IettSource but tuned for whatever Ankara EGO
// (or a community mirror) publishes. The field names below match the
// "documented" v1 endpoint; if EGO never returns to publishing live data,
// this source no-ops gracefully.
type EgoSource struct {
	url      string
	interval time.Duration
	client   *http.Client
	cb       *CircuitBreaker
	logger   *slog.Logger
}

type EgoConfig struct {
	URL         string
	IntervalSec int
	HTTPTimeout time.Duration
	Logger      *slog.Logger
}

func NewEgoSource(cfg EgoConfig) *EgoSource {
	if cfg.IntervalSec == 0 {
		cfg.IntervalSec = 20
	}
	if cfg.HTTPTimeout == 0 {
		cfg.HTTPTimeout = 10 * time.Second
	}
	return &EgoSource{
		url:      cfg.URL,
		interval: time.Duration(cfg.IntervalSec) * time.Second,
		client:   &http.Client{Timeout: cfg.HTTPTimeout},
		cb:       NewCircuitBreaker(3, 5*time.Minute),
		logger:   cfg.Logger,
	}
}

func (*EgoSource) Name() string { return "ego" }

type egoApiVehicle struct {
	VehicleID  string  `json:"plaka"`
	RouteCode  string  `json:"hat"`
	Lat        float64 `json:"lat"`
	Lng        float64 `json:"lng"`
	Speed      float64 `json:"hiz"`
	Heading    float64 `json:"yon"`
	RecordedAt string  `json:"zaman"`
}

func (s *EgoSource) Run(ctx context.Context, out chan<- types.Position) error {
	if s.url == "" {
		// Without a configured source we don't error — we just idle. Lets the
		// worker stay healthy in dev when Ankara feed is unreachable.
		s.logger.Warn("ego url not configured — source idle")
		<-ctx.Done()
		return ctx.Err()
	}
	t := time.NewTicker(s.interval)
	defer t.Stop()
	attempt := 0

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-t.C:
		}

		if !s.cb.Allow() {
			continue
		}

		_, err := s.poll(ctx, out)
		if err != nil {
			attempt++
			s.cb.RecordFailure()
			delay := Backoff(attempt, time.Second, 5*time.Minute)
			s.logger.Warn("ego poll failed", "err", err, "attempt", attempt, "next_in", delay)
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(delay):
			}
			continue
		}
		attempt = 0
		s.cb.RecordSuccess()
	}
}

func (s *EgoSource) poll(ctx context.Context, out chan<- types.Position) (int, error) {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, s.url, nil)
	req.Header.Set("user-agent", "app-bus/0.0.0 (+https://app-bus.tr)")
	res, err := s.client.Do(req)
	if err != nil {
		return 0, err
	}
	defer res.Body.Close()

	if res.StatusCode/100 != 2 {
		body, _ := io.ReadAll(io.LimitReader(res.Body, 512))
		return 0, fmt.Errorf("status %d: %s", res.StatusCode, string(body))
	}

	var vehicles []egoApiVehicle
	if err := json.NewDecoder(res.Body).Decode(&vehicles); err != nil {
		return 0, err
	}

	for _, v := range vehicles {
		if v.VehicleID == "" || v.RouteCode == "" {
			continue
		}
		t := parseIettTime(v.RecordedAt)
		select {
		case <-ctx.Done():
			return 0, ctx.Err()
		case out <- types.Position{
			VehicleID:       "ego:" + v.VehicleID,
			OperatorCode:    "ego",
			RouteExternalID: v.RouteCode,
			CityCode:        "ANK",
			Lat:             v.Lat,
			Lng:             v.Lng,
			SpeedKmh:        float32(v.Speed),
			Heading:         float32(v.Heading),
			RecordedAt:      t,
			SourceLagMs:     time.Since(t).Milliseconds(),
		}:
		}
	}
	return len(vehicles), nil
}
