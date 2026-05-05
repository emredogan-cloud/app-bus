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

// IettSource — HTTP poller for the İETT live position feed.
//
// Source URL is operator-configurable so we can switch to v2 endpoints or
// republished mirrors without redeploying. Backoff + circuit breaker apply
// per-failure; success resets state.
type IettSource struct {
	url      string
	interval time.Duration
	client   *http.Client
	cb       *CircuitBreaker
	logger   *slog.Logger
}

type IettConfig struct {
	URL         string
	IntervalSec int
	HTTPTimeout time.Duration
	Logger      *slog.Logger
}

func NewIettSource(cfg IettConfig) *IettSource {
	if cfg.IntervalSec == 0 {
		cfg.IntervalSec = 15
	}
	if cfg.HTTPTimeout == 0 {
		cfg.HTTPTimeout = 10 * time.Second
	}
	return &IettSource{
		url:      cfg.URL,
		interval: time.Duration(cfg.IntervalSec) * time.Second,
		client:   &http.Client{Timeout: cfg.HTTPTimeout},
		cb:       NewCircuitBreaker(3, 5*time.Minute),
		logger:   cfg.Logger,
	}
}

func (*IettSource) Name() string { return "iett" }

// İETT documented schema (subset). Exact field names vary by upstream version;
// we document the shape our parser expects so swaps stay localized to this file.
type iettApiVehicle struct {
	VehicleID string  `json:"vehicleNo"`
	RouteCode string  `json:"hatKodu"`
	Lat       float64 `json:"konumX"`
	Lng       float64 `json:"konumY"`
	Speed     float64 `json:"hiz"`
	Heading   float64 `json:"yon"`
	// e.g. "2026-05-05T14:33:01"
	RecordedAt string `json:"konumZamani"`
}

func (s *IettSource) Run(ctx context.Context, out chan<- types.Position) error {
	if s.url == "" {
		return fmt.Errorf("iett url not configured")
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
			s.logger.Warn("iett circuit open, skipping poll")
			continue
		}

		count, err := s.poll(ctx, out)
		if err != nil {
			attempt++
			s.cb.RecordFailure()
			delay := Backoff(attempt, time.Second, 5*time.Minute)
			s.logger.Warn("iett poll failed", "err", err, "attempt", attempt, "next_in", delay)
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(delay):
			}
			continue
		}
		attempt = 0
		s.cb.RecordSuccess()
		s.logger.Debug("iett poll ok", "vehicles", count)
	}
}

func (s *IettSource) poll(ctx context.Context, out chan<- types.Position) (int, error) {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, s.url, nil)
	req.Header.Set("user-agent", "app-bus/0.0.0 (+https://app-bus.tr)")

	res, err := s.client.Do(req)
	if err != nil {
		return 0, err
	}
	defer res.Body.Close()

	if res.StatusCode == http.StatusTooManyRequests {
		return 0, fmt.Errorf("rate-limited: 429")
	}
	if res.StatusCode/100 != 2 {
		body, _ := io.ReadAll(io.LimitReader(res.Body, 512))
		return 0, fmt.Errorf("status %d: %s", res.StatusCode, string(body))
	}

	var vehicles []iettApiVehicle
	if err := json.NewDecoder(res.Body).Decode(&vehicles); err != nil {
		return 0, fmt.Errorf("decode: %w", err)
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
			VehicleID:       "iett:" + v.VehicleID,
			OperatorCode:    "iett",
			RouteExternalID: v.RouteCode,
			CityCode:        "IST",
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

func parseIettTime(s string) time.Time {
	if s == "" {
		return time.Now().UTC()
	}
	// Try multiple layouts since the upstream is inconsistent
	for _, layout := range []string{
		time.RFC3339,
		"2006-01-02T15:04:05",
		"2006-01-02 15:04:05",
	} {
		if t, err := time.ParseInLocation(layout, s, istTZ()); err == nil {
			return t.UTC()
		}
	}
	return time.Now().UTC()
}

func istTZ() *time.Location {
	loc, err := time.LoadLocation("Europe/Istanbul")
	if err != nil {
		return time.FixedZone("IST", 3*3600)
	}
	return loc
}
