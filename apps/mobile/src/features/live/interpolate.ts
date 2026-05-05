/**
 * Hermite-spline-style interpolation over a small history of (lat, lng, t).
 * Phase 4 ships a linear-extrapolation skeleton with the API surface the
 * MapLibre marker animation in Phase 4.5 will use; the full Hermite kernel
 * lands when we wire MapLibre's 60fps render hook.
 */

export interface Sample {
  lat: number;
  lng: number;
  t: number; // unix ms
}

/**
 * Linear extrapolation toward `nowMs`, given the last 2-3 samples.
 * If only one sample, returns it. If samples are >5s old, returns the latest
 * with no extrapolation (avoids snapping past the last known position).
 */
export function interpolate(samples: Sample[], nowMs: number): Sample | null {
  if (samples.length === 0) return null;
  const latest = samples[samples.length - 1];
  if (samples.length === 1) return latest;
  const prev = samples[samples.length - 2];
  const dt = latest.t - prev.t;
  if (dt <= 0) return latest;
  const elapsedSinceLatest = nowMs - latest.t;
  if (elapsedSinceLatest > 5000) return latest;

  const ratio = elapsedSinceLatest / dt;
  return {
    lat: latest.lat + (latest.lat - prev.lat) * ratio,
    lng: latest.lng + (latest.lng - prev.lng) * ratio,
    t: nowMs,
  };
}

export function pushSample(history: Sample[], next: Sample, max = 4): Sample[] {
  const out = [...history, next];
  return out.length > max ? out.slice(out.length - max) : out;
}
