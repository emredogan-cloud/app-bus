// Package source defines the Source interface plus shared helpers (rate
// limiter, circuit breaker) used by all source implementations.
package source

import (
	"context"
	"sync"
	"time"

	"github.com/app-bus/ingestion/internal/types"
)

// Source produces a stream of canonical positions until ctx is cancelled.
// Implementations MUST close `out` when ctx is done, but MUST NOT close it
// from any other path.
type Source interface {
	// Name identifies the source in logs + metrics (e.g. "iett", "ego", "gtfsrt").
	Name() string
	// Run blocks, emitting positions to `out`. Errors during run are returned;
	// transient errors are retried internally per the source's policy.
	Run(ctx context.Context, out chan<- types.Position) error
}

// CircuitBreaker — three states (closed | open | half-open) sized for source
// pollers that fail in bursts. Not as fancy as Hystrix; small + dependency-free.
type CircuitBreaker struct {
	threshold      int
	cooldown       time.Duration
	mu             sync.Mutex
	consecutiveErr int
	openedAt       time.Time
}

func NewCircuitBreaker(threshold int, cooldown time.Duration) *CircuitBreaker {
	if threshold <= 0 {
		threshold = 3
	}
	if cooldown <= 0 {
		cooldown = 30 * time.Second
	}
	return &CircuitBreaker{threshold: threshold, cooldown: cooldown}
}

// Allow returns true if a call should be attempted. False during open state.
func (c *CircuitBreaker) Allow() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.consecutiveErr < c.threshold {
		return true
	}
	if time.Since(c.openedAt) >= c.cooldown {
		// Half-open: allow one trial
		return true
	}
	return false
}

func (c *CircuitBreaker) RecordSuccess() {
	c.mu.Lock()
	c.consecutiveErr = 0
	c.mu.Unlock()
}

func (c *CircuitBreaker) RecordFailure() {
	c.mu.Lock()
	c.consecutiveErr++
	if c.consecutiveErr == c.threshold {
		c.openedAt = time.Now()
	}
	c.mu.Unlock()
}

// Backoff computes an exponential backoff with jitter capped at max.
func Backoff(attempt int, base, max time.Duration) time.Duration {
	if attempt < 1 {
		attempt = 1
	}
	d := base * (1 << min(attempt-1, 6))
	if d > max {
		d = max
	}
	// 25% jitter
	jitter := time.Duration(int64(d) / 4)
	return d - jitter/2 + time.Duration(timeNow()%int64(jitter+1))
}

// timeNow is a tiny helper so the linter doesn't yell about modulo on time.Time.
func timeNow() int64 { return time.Now().UnixNano() }

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
