import { RuleMatcher, type RuleLike } from './rule-matcher.js';

describe('RuleMatcher', () => {
  const m = new RuleMatcher();

  const baseRule: RuleLike = {
    threshold_minutes: 5,
    days_of_week_bitmask: 0b1111111,
    quiet_hours_start_min: null,
    quiet_hours_end_min: null,
  };

  const params = (overrides: Partial<Parameters<RuleMatcher['matches']>[0]> = {}) => ({
    rule: baseRule,
    etaUnix: 1_000_000 + 5 * 60, // 5 min in the future
    nowUnix: 1_000_000,
    nowLocalMinutes: 8 * 60,
    nowLocalDow: 1, // Tuesday
    ...overrides,
  });

  it('fires at threshold exactly', () => {
    expect(m.matches(params())).toBe(true);
  });

  it('fires within the lower slop window (threshold-1 ≤ minutes ≤ threshold)', () => {
    expect(m.matches(params({ etaUnix: 1_000_000 + 4 * 60 }))).toBe(true);
    // Past-threshold ETAs should NOT fire — the next evaluator cycle catches a fresher ETA.
    expect(m.matches(params({ etaUnix: 1_000_000 + 5 * 60 + 31 }))).toBe(false);
  });

  it('does not fire well before threshold', () => {
    expect(m.matches(params({ etaUnix: 1_000_000 + 10 * 60 }))).toBe(false);
  });

  it('does not fire after threshold passes', () => {
    expect(m.matches(params({ etaUnix: 1_000_000 + 60 }))).toBe(false);
  });

  it('respects day-of-week bitmask (only weekdays)', () => {
    const weekdays: RuleLike = { ...baseRule, days_of_week_bitmask: 0b0011111 }; // Mon-Fri
    expect(m.matches(params({ rule: weekdays, nowLocalDow: 1 }))).toBe(true);
    expect(m.matches(params({ rule: weekdays, nowLocalDow: 5 }))).toBe(false); // Saturday
  });

  it('blocks during quiet hours window (non-wrapping)', () => {
    const rule = { ...baseRule, quiet_hours_start_min: 22 * 60, quiet_hours_end_min: 23 * 60 };
    expect(m.matches(params({ rule, nowLocalMinutes: 22 * 60 + 30 }))).toBe(false);
    expect(m.matches(params({ rule, nowLocalMinutes: 23 * 60 + 1 }))).toBe(true);
  });

  it('blocks during quiet hours window (wraps midnight 22:00 → 07:00)', () => {
    const rule = { ...baseRule, quiet_hours_start_min: 22 * 60, quiet_hours_end_min: 7 * 60 };
    expect(m.matches(params({ rule, nowLocalMinutes: 23 * 60 }))).toBe(false);
    expect(m.matches(params({ rule, nowLocalMinutes: 1 * 60 }))).toBe(false);
    expect(m.matches(params({ rule, nowLocalMinutes: 8 * 60 }))).toBe(true);
  });
});
