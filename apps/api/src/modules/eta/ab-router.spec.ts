import { ConfigService } from '@nestjs/config';
import { AbRouter } from './ab-router.js';

describe('AbRouter', () => {
  it('always heuristic when traffic_pct=0', () => {
    const r = new AbRouter(new ConfigService({ ML_ETA_TRAFFIC_PCT: 0 } as never));
    for (let i = 0; i < 100; i++) {
      expect(r.pick({ userId: `u${i}` })).toBe('heuristic');
    }
  });

  it('always heuristic for anonymous', () => {
    const r = new AbRouter(new ConfigService({ ML_ETA_TRAFFIC_PCT: 100 } as never));
    expect(r.pick({})).toBe('heuristic');
  });

  it('always ml when traffic_pct=100 and user is set', () => {
    const r = new AbRouter(new ConfigService({ ML_ETA_TRAFFIC_PCT: 100 } as never));
    for (let i = 0; i < 50; i++) {
      expect(r.pick({ userId: `u${i}` })).toBe('ml');
    }
  });

  it('assignment is stable for the same user', () => {
    const r = new AbRouter(new ConfigService({ ML_ETA_TRAFFIC_PCT: 50 } as never));
    const a = r.pick({ userId: 'stable-user' });
    const b = r.pick({ userId: 'stable-user' });
    expect(a).toBe(b);
  });

  it('roughly splits at 50%', () => {
    const r = new AbRouter(new ConfigService({ ML_ETA_TRAFFIC_PCT: 50 } as never));
    let ml = 0;
    const N = 5000;
    for (let i = 0; i < N; i++) if (r.pick({ userId: `u${i}` }) === 'ml') ml++;
    // Tolerance ±5% — at N=5000 the binomial variance gives a clear signal.
    expect(ml / N).toBeGreaterThan(0.45);
    expect(ml / N).toBeLessThan(0.55);
  });
});
