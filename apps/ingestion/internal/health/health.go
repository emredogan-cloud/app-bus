// Package health provides liveness/readiness HTTP handlers.
package health

import (
	"encoding/json"
	"net/http"
	"sync/atomic"
	"time"
)

// startedAt is set at process start and used to compute uptime.
var startedAt = time.Now()

// Ready is flipped to 1 when downstream dependencies are reachable.
// Phase 0: ready as soon as the http server binds. Phase 3 wires real checks.
var Ready int32

// NewMux returns an http.Handler exposing /health and /ready.
func NewMux(version string) http.Handler {
	mux := http.NewServeMux()
	atomic.StoreInt32(&Ready, 1)

	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"status":   "ok",
			"service":  "ingestion",
			"version":  version,
			"uptime_s": int(time.Since(startedAt).Seconds()),
		})
	})

	mux.HandleFunc("/ready", func(w http.ResponseWriter, _ *http.Request) {
		if atomic.LoadInt32(&Ready) == 1 {
			writeJSON(w, http.StatusOK, map[string]any{"status": "ready"})
			return
		}
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"status": "not_ready"})
	})

	return mux
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
