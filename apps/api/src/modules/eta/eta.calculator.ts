import { Injectable } from '@nestjs/common';

export type Confidence = 'high' | 'medium' | 'low';

export interface DownstreamStop {
  stop_id: string;
  /** Distance from route start to this stop along the LINESTRING shape. */
  distance_along_shape_m: number;
}

/**
 * EwmaSpeedTracker — exponentially-weighted moving average of speed for a
 * single (route_id) bucket. Alpha=0.3 per the Phase 5 spec. Buckets are
 * created lazily and reset after `staleAfterMs` of inactivity.
 */
export class EwmaSpeedTracker {
  private readonly buckets = new Map<string, { speedMps: number; updatedAt: number }>();
  constructor(
    private readonly alpha = 0.3,
    /** Minimum speed used in projections (km/h). 5 km/h ≈ walking pace; the bus
     * isn't actually stopped, just at a red light. */
    private readonly floorKmh = 5,
    private readonly staleAfterMs = 5 * 60 * 1000,
  ) {}

  observe(routeId: string, speedKmh: number, atMs: number): void {
    const speedMps = Math.max(speedKmh, this.floorKmh) / 3.6;
    const cur = this.buckets.get(routeId);
    if (!cur || atMs - cur.updatedAt > this.staleAfterMs) {
      this.buckets.set(routeId, { speedMps, updatedAt: atMs });
      return;
    }
    const next = this.alpha * speedMps + (1 - this.alpha) * cur.speedMps;
    this.buckets.set(routeId, { speedMps: next, updatedAt: atMs });
  }

  /** Returns m/s. Falls back to floor when no observation exists. */
  smoothedMps(routeId: string): number {
    const v = this.buckets.get(routeId);
    if (!v) return this.floorKmh / 3.6;
    return v.speedMps;
  }
}

@Injectable()
export class EtaCalculator {
  readonly tracker = new EwmaSpeedTracker();

  /**
   * Compute ETAs for stops downstream of `vehicleDistanceM` on the same route.
   * Returns one row per stop, sorted by ascending ETA.
   */
  computeFor(input: {
    vehicleDistanceM: number;
    routeId: string;
    speedKmh: number;
    recordedAtMs: number;
    nowMs: number;
    downstream: DownstreamStop[];
    /** Distance threshold beyond which we don't bother computing (m). */
    horizonM?: number;
  }): Array<{ stop_id: string; eta_unix: number; eta_seconds: number; confidence: Confidence }> {
    const horizon = input.horizonM ?? 5000;
    this.tracker.observe(input.routeId, input.speedKmh, input.recordedAtMs);
    const speedMps = this.tracker.smoothedMps(input.routeId);

    const fresh = input.nowMs - input.recordedAtMs;
    const baseConfidence: Confidence =
      fresh <= 30_000 ? 'high' : fresh <= 90_000 ? 'medium' : 'low';

    const out: Array<{
      stop_id: string;
      eta_unix: number;
      eta_seconds: number;
      confidence: Confidence;
    }> = [];

    for (const s of input.downstream) {
      const remainingM = s.distance_along_shape_m - input.vehicleDistanceM;
      if (remainingM <= 0) continue;
      if (remainingM > horizon) continue;
      const seconds = Math.round(remainingM / speedMps);
      // The further out, the less confident — a 30-min ETA from 90s-old data is "low".
      const distanceConfidence: Confidence =
        remainingM <= 1500 ? baseConfidence : downgrade(baseConfidence);
      out.push({
        stop_id: s.stop_id,
        eta_unix: Math.floor(input.nowMs / 1000) + seconds,
        eta_seconds: seconds,
        confidence: distanceConfidence,
      });
    }

    out.sort((a, b) => a.eta_unix - b.eta_unix);
    return out;
  }
}

function downgrade(c: Confidence): Confidence {
  return c === 'high' ? 'medium' : c === 'medium' ? 'low' : 'low';
}
