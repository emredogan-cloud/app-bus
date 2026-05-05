import { RateLimitService } from './rate-limit.service.js';

describe('RateLimitService (in-memory shim)', () => {
  let svc: RateLimitService;
  beforeEach(() => {
    svc = new RateLimitService(null);
  });

  it('allows up to capacity then blocks', async () => {
    const cfg = { key: 'k1', capacity: 3, refillPerSec: 0.0001 }; // effectively no refill within test
    expect((await svc.consume(cfg)).allowed).toBe(true);
    expect((await svc.consume(cfg)).allowed).toBe(true);
    expect((await svc.consume(cfg)).allowed).toBe(true);
    const blocked = await svc.consume(cfg);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it('refills over time', async () => {
    const cfg = { key: 'k2', capacity: 1, refillPerSec: 1000 };
    expect((await svc.consume(cfg)).allowed).toBe(true);
    expect((await svc.consume(cfg)).allowed).toBe(false);
    await new Promise((r) => setTimeout(r, 5));
    expect((await svc.consume(cfg)).allowed).toBe(true);
  });

  it('isolates buckets by key', async () => {
    const a = await svc.consume({ key: 'a', capacity: 1, refillPerSec: 0.0001 });
    const b = await svc.consume({ key: 'b', capacity: 1, refillPerSec: 0.0001 });
    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(true);
  });
});
