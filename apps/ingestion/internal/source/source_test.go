package source

import (
	"testing"
	"time"
)

func TestCircuitBreaker_OpensAfterThreshold(t *testing.T) {
	cb := NewCircuitBreaker(3, 50*time.Millisecond)
	if !cb.Allow() {
		t.Fatal("fresh breaker should allow")
	}
	cb.RecordFailure()
	cb.RecordFailure()
	cb.RecordFailure()
	if cb.Allow() {
		t.Fatal("breaker should be open after 3 failures")
	}
	time.Sleep(60 * time.Millisecond)
	if !cb.Allow() {
		t.Fatal("breaker should half-open after cooldown")
	}
	cb.RecordSuccess()
	if !cb.Allow() {
		t.Fatal("breaker should be closed after success")
	}
}

func TestBackoff_GrowsAndCaps(t *testing.T) {
	max := 10 * time.Second
	d1 := Backoff(1, 100*time.Millisecond, max)
	d3 := Backoff(3, 100*time.Millisecond, max)
	d10 := Backoff(10, 100*time.Millisecond, max)
	if d1 >= d3 {
		t.Errorf("expected attempt 3 backoff > attempt 1: %v vs %v", d3, d1)
	}
	if d10 > max {
		t.Errorf("backoff exceeded cap: %v > %v", d10, max)
	}
}
