import { SubscribeRequestSchema, bboxDiagonalKm, bboxContains } from './types.js';

describe('SubscribeRequest validation', () => {
  it('accepts a route subscription', () => {
    expect(
      SubscribeRequestSchema.parse({ kind: 'route', city: 'IST', route_external_id: '500T' }),
    ).toMatchObject({ kind: 'route' });
  });

  it('accepts a bbox subscription', () => {
    expect(
      SubscribeRequestSchema.parse({ kind: 'bbox', bbox: [28.9, 41.0, 29.1, 41.1] }),
    ).toMatchObject({ kind: 'bbox' });
  });

  it('rejects bbox out of bounds', () => {
    expect(() => SubscribeRequestSchema.parse({ kind: 'bbox', bbox: [200, 0, 0, 0] })).toThrow();
  });

  it('rejects unknown kind', () => {
    expect(() => SubscribeRequestSchema.parse({ kind: 'world' })).toThrow();
  });
});

describe('bboxDiagonalKm', () => {
  it('approximates ~1km box', () => {
    // 1° lat ≈ 110.57km, so 0.01° lat ≈ 1.1km
    const d = bboxDiagonalKm([28.985, 41.036, 28.985, 41.046]);
    expect(d).toBeGreaterThan(0.5);
    expect(d).toBeLessThan(2);
  });

  it('returns Infinity for inverted box', () => {
    expect(bboxDiagonalKm([29, 41, 28, 40])).toBe(Infinity);
  });
});

describe('bboxContains', () => {
  it('inside', () => {
    expect(bboxContains([28.9, 41.0, 29.1, 41.1], 41.05, 29.0)).toBe(true);
  });
  it('outside lat', () => {
    expect(bboxContains([28.9, 41.0, 29.1, 41.1], 42.0, 29.0)).toBe(false);
  });
  it('outside lng', () => {
    expect(bboxContains([28.9, 41.0, 29.1, 41.1], 41.05, 30.0)).toBe(false);
  });
});
