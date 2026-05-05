import { EtaCalculator, EwmaSpeedTracker } from './eta.calculator.js';

describe('EwmaSpeedTracker', () => {
  it('initializes with first observation', () => {
    const t = new EwmaSpeedTracker();
    t.observe('R1', 36, 1000); // 10 m/s
    expect(t.smoothedMps('R1')).toBeCloseTo(10, 5);
  });

  it('blends with alpha=0.3', () => {
    const t = new EwmaSpeedTracker(0.3);
    t.observe('R1', 36, 1000); // 10 m/s
    t.observe('R1', 0, 2000); // floor 5 km/h ≈ 1.39 m/s
    // 0.3 * 1.39 + 0.7 * 10 ≈ 7.42
    expect(t.smoothedMps('R1')).toBeGreaterThan(6.5);
    expect(t.smoothedMps('R1')).toBeLessThan(8);
  });

  it('resets if stale', () => {
    const t = new EwmaSpeedTracker();
    t.observe('R1', 36, 0);
    t.observe('R1', 72, 6 * 60 * 1000); // 6 min later
    expect(t.smoothedMps('R1')).toBeCloseTo(20, 1);
  });

  it('isolates buckets per route', () => {
    const t = new EwmaSpeedTracker();
    t.observe('R1', 36, 0);
    t.observe('R2', 72, 0);
    expect(t.smoothedMps('R1')).toBeCloseTo(10, 1);
    expect(t.smoothedMps('R2')).toBeCloseTo(20, 1);
  });
});

describe('EtaCalculator.computeFor', () => {
  const downstream = [
    { stop_id: 's1', distance_along_shape_m: 500 },
    { stop_id: 's2', distance_along_shape_m: 1500 },
    { stop_id: 's3', distance_along_shape_m: 3000 },
  ];

  it('computes ETAs sorted ascending by eta_unix', () => {
    const c = new EtaCalculator();
    const out = c.computeFor({
      vehicleDistanceM: 100,
      routeId: 'R',
      speedKmh: 36, // 10 m/s
      recordedAtMs: 1000,
      nowMs: 1000,
      downstream,
    });
    expect(out.map((r) => r.stop_id)).toEqual(['s1', 's2', 's3']);
    expect(out[0].eta_seconds).toBeCloseTo((500 - 100) / 10, 0);
  });

  it('drops stops upstream of vehicle', () => {
    const c = new EtaCalculator();
    const out = c.computeFor({
      vehicleDistanceM: 600,
      routeId: 'R',
      speedKmh: 36,
      recordedAtMs: 1000,
      nowMs: 1000,
      downstream,
    });
    expect(out.map((r) => r.stop_id)).toEqual(['s2', 's3']);
  });

  it('respects horizonM', () => {
    const c = new EtaCalculator();
    const out = c.computeFor({
      vehicleDistanceM: 0,
      routeId: 'R',
      speedKmh: 36,
      recordedAtMs: 1000,
      nowMs: 1000,
      downstream,
      horizonM: 1000,
    });
    expect(out.map((r) => r.stop_id)).toEqual(['s1']);
  });

  it('marks confidence high when fresh + close, downgrades far stops', () => {
    const c = new EtaCalculator();
    const fresh = c.computeFor({
      vehicleDistanceM: 0,
      routeId: 'R',
      speedKmh: 36,
      recordedAtMs: Date.now(),
      nowMs: Date.now(),
      downstream,
    });
    expect(fresh.find((r) => r.stop_id === 's1')!.confidence).toBe('high');
    expect(fresh.find((r) => r.stop_id === 's3')!.confidence).toBe('medium');
  });

  it('downgrades to low when data > 90s old', () => {
    const c = new EtaCalculator();
    const stale = c.computeFor({
      vehicleDistanceM: 0,
      routeId: 'R',
      speedKmh: 36,
      recordedAtMs: 0,
      nowMs: 100_000, // 100s after recording
      downstream,
    });
    expect(stale.every((r) => r.confidence === 'low')).toBe(true);
  });
});
