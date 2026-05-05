package sink

import (
	"context"
	"io"
	"log/slog"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/app-bus/ingestion/internal/types"
)

// recordingSink counts how many positions it actually receives.
type recordingSink struct {
	mu    sync.Mutex
	got   []string
	delay time.Duration
}

func (r *recordingSink) Name() string { return "rec" }

func (r *recordingSink) Send(_ context.Context, p types.Position) {
	if r.delay > 0 {
		time.Sleep(r.delay)
	}
	r.mu.Lock()
	r.got = append(r.got, p.VehicleID)
	r.mu.Unlock()
}

func (*recordingSink) Close(_ context.Context) error { return nil }

func TestFanOut_DeliversAllPositions_NoBackpressure(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	rec := &recordingSink{}
	f := NewFanOut(logger, rec)
	in := make(chan types.Position)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	done := make(chan struct{})
	go func() { f.Run(ctx, in); close(done) }()

	for i := 0; i < 50; i++ {
		in <- types.Position{VehicleID: "v" + string(rune('A'+i%26))}
	}
	close(in)
	<-done

	rec.mu.Lock()
	defer rec.mu.Unlock()
	if len(rec.got) != 50 {
		t.Errorf("got %d positions, want 50", len(rec.got))
	}
}

func TestFanOut_DropsOldestWhenSinkSlow(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	slow := &recordingSink{delay: 10 * time.Millisecond}
	f := NewFanOut(logger, slow)
	f.bufferSize = 4 // tiny buffer to force drops
	in := make(chan types.Position)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	done := make(chan struct{})
	go func() { f.Run(ctx, in); close(done) }()

	// Push 1000 positions as fast as possible — slow sink can't keep up
	var sent atomic.Int64
	for i := 0; i < 1000; i++ {
		in <- types.Position{VehicleID: "v"}
		sent.Add(1)
	}
	close(in)
	<-done

	slow.mu.Lock()
	got := len(slow.got)
	slow.mu.Unlock()

	if int64(got) >= sent.Load() {
		t.Errorf("expected drops with slow sink: sent=%d got=%d", sent.Load(), got)
	}
	if got == 0 {
		t.Errorf("expected slow sink to receive at least some positions, got 0")
	}
	t.Logf("sent=%d delivered=%d (drops=%d)", sent.Load(), got, sent.Load()-int64(got))
}
