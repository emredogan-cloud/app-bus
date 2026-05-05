import { SubscriptionRegistry } from './subscription.registry.js';

describe('SubscriptionRegistry', () => {
  let reg: SubscriptionRegistry;
  beforeEach(() => {
    reg = new SubscriptionRegistry();
    reg.attach('s1');
  });

  it('adds and removes a route subscription', () => {
    const r = reg.add('s1', { kind: 'route', city: 'IST', route_external_id: '500T' });
    expect('sub_id' in r).toBe(true);
    expect(reg.remove('s1', (r as { sub_id: string }).sub_id)).toBe(true);
  });

  it('rejects beyond max-subs limit', () => {
    for (let i = 0; i < 50; i++) {
      reg.add('s1', { kind: 'route', city: 'IST', route_external_id: `R${i}` });
    }
    const r = reg.add('s1', { kind: 'route', city: 'IST', route_external_id: 'overflow' });
    expect((r as { error: string }).error).toBe('subscription_limit');
  });

  it('matches route subscription by exact route_external_id + city', () => {
    reg.add('s1', { kind: 'route', city: 'IST', route_external_id: '500T' });
    const matches = reg.match({
      vehicle_id: 'iett:34A',
      route_external_id: '500T',
      city: 'IST',
      lat: 41.04,
      lng: 28.99,
      speed_kmh: 30,
      heading: 90,
      recorded_at: new Date().toISOString(),
    });
    expect(matches).toHaveLength(1);
  });

  it('matches bbox subscription by lat/lng', () => {
    reg.add('s1', { kind: 'bbox', bbox: [28.9, 41.0, 29.1, 41.1] });
    const matches = reg.match({
      vehicle_id: 'iett:34B',
      route_external_id: '500T',
      city: 'IST',
      lat: 41.05,
      lng: 29.0,
      speed_kmh: 0,
      heading: 0,
      recorded_at: new Date().toISOString(),
    });
    expect(matches).toHaveLength(1);
  });

  it('does not match bbox when wrong city is set', () => {
    reg.add('s1', { kind: 'bbox', city: 'ANK', bbox: [28.9, 41.0, 29.1, 41.1] });
    const matches = reg.match({
      vehicle_id: 'iett:34C',
      route_external_id: '500T',
      city: 'IST',
      lat: 41.05,
      lng: 29.0,
      speed_kmh: 0,
      heading: 0,
      recorded_at: new Date().toISOString(),
    });
    expect(matches).toHaveLength(0);
  });
});
