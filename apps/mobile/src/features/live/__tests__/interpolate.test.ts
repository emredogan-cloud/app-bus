import { interpolate, pushSample } from '../interpolate';

describe('interpolate', () => {
  it('returns null for empty history', () => {
    expect(interpolate([], 1000)).toBeNull();
  });

  it('returns the only sample as-is', () => {
    const s = { lat: 41, lng: 29, t: 1000 };
    expect(interpolate([s], 2000)).toEqual(s);
  });

  it('linearly extrapolates between two samples', () => {
    const a = { lat: 41.0, lng: 29.0, t: 1000 };
    const b = { lat: 41.001, lng: 29.001, t: 2000 };
    const at3000 = interpolate([a, b], 3000);
    // Should extrapolate one more step (ratio=1.0)
    expect(at3000!.lat).toBeCloseTo(41.002, 5);
    expect(at3000!.lng).toBeCloseTo(29.002, 5);
  });

  it('clamps to latest when extrapolation gap > 5s', () => {
    const a = { lat: 41.0, lng: 29.0, t: 1000 };
    const b = { lat: 41.001, lng: 29.001, t: 2000 };
    expect(interpolate([a, b], 8000)).toEqual(b);
  });
});

describe('pushSample', () => {
  it('caps history length to max', () => {
    let h: Array<{ lat: number; lng: number; t: number }> = [];
    for (let i = 0; i < 10; i++) {
      h = pushSample(h, { lat: i, lng: 0, t: i * 1000 }, 4);
    }
    expect(h).toHaveLength(4);
    expect(h[0].lat).toBe(6);
    expect(h[3].lat).toBe(9);
  });
});
