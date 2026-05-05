// Package sink defines the Sink interface and a fan-out that runs all sinks
// concurrently with bounded buffers.
package sink

import (
	"context"
	"log/slog"
	"sync"

	"github.com/app-bus/ingestion/internal/types"
)

// Sink consumes positions one-by-one. Failures should be logged but not
// returned — the pipeline tolerates per-sink errors.
type Sink interface {
	Name() string
	Send(ctx context.Context, p types.Position)
	Close(ctx context.Context) error
}

// FanOut runs N sinks in parallel from a single input channel, each backed by
// its own bounded buffer. When a sink's buffer is full we drop the OLDEST
// message (since latest-wins is the correct semantics for live position state).
type FanOut struct {
	sinks []Sink
	logger *slog.Logger
	bufferSize int
}

func NewFanOut(logger *slog.Logger, sinks ...Sink) *FanOut {
	return &FanOut{sinks: sinks, logger: logger, bufferSize: 1024}
}

// Run blocks until the input channel closes or ctx is cancelled.
func (f *FanOut) Run(ctx context.Context, in <-chan types.Position) {
	wg := sync.WaitGroup{}
	chans := make([]chan types.Position, len(f.sinks))
	for i, s := range f.sinks {
		ch := make(chan types.Position, f.bufferSize)
		chans[i] = ch
		wg.Add(1)
		go func(s Sink, ch <-chan types.Position) {
			defer wg.Done()
			for p := range ch {
				s.Send(ctx, p)
			}
		}(s, ch)
	}

	for {
		select {
		case <-ctx.Done():
			for _, ch := range chans {
				close(ch)
			}
			wg.Wait()
			return
		case p, ok := <-in:
			if !ok {
				for _, ch := range chans {
					close(ch)
				}
				wg.Wait()
				return
			}
			for i, ch := range chans {
				select {
				case ch <- p:
				default:
					// drop-oldest: pull one off and replace
					select {
					case <-ch:
					default:
					}
					select {
					case ch <- p:
					default:
						// extreme backpressure; drop the new message
						f.logger.Warn("sink buffer overflow", "sink", f.sinks[i].Name())
					}
				}
			}
		}
	}
}

func (f *FanOut) Close(ctx context.Context) {
	for _, s := range f.sinks {
		if err := s.Close(ctx); err != nil {
			f.logger.Warn("sink close failed", "sink", s.Name(), "err", err)
		}
	}
}
