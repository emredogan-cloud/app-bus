import { Injectable } from '@nestjs/common';

export interface RuleLike {
  threshold_minutes: number;
  days_of_week_bitmask: number;
  quiet_hours_start_min: number | null;
  quiet_hours_end_min: number | null;
}

/**
 * Decides whether an ETA matches a notification rule "right now".
 *
 * The rule fires when:
 *   - the ETA's minutes-until-arrival is exactly threshold (with ±1min slop)
 *   - the day-of-week bitmask covers today (0=Mon … 6=Sun)
 *   - the local time is NOT inside the rule's quiet-hours window
 *
 * Quiet hours are stored as minutes-from-midnight in the user's local
 * timezone. We accept them as already-converted values from the caller
 * (which carries the user's `locale`/timezone preference).
 */
@Injectable()
export class RuleMatcher {
  matches(input: {
    rule: RuleLike;
    etaUnix: number;
    nowUnix: number;
    /** Minutes-from-midnight in the user's local timezone (0..1439). */
    nowLocalMinutes: number;
    /** Day of week 0=Mon..6=Sun in the user's local timezone. */
    nowLocalDow: number;
  }): boolean {
    const { rule, etaUnix, nowUnix, nowLocalMinutes, nowLocalDow } = input;

    if (!ruleAllowsDay(rule, nowLocalDow)) return false;
    if (inQuietHours(rule, nowLocalMinutes)) return false;

    const minutesUntil = Math.round((etaUnix - nowUnix) / 60);
    // Fire window: threshold-1 ≤ minutesUntil ≤ threshold (1-minute slop)
    return minutesUntil >= rule.threshold_minutes - 1 && minutesUntil <= rule.threshold_minutes;
  }
}

function ruleAllowsDay(rule: RuleLike, dow: number): boolean {
  const mask = rule.days_of_week_bitmask;
  return (mask & (1 << dow)) !== 0;
}

function inQuietHours(rule: RuleLike, nowLocalMinutes: number): boolean {
  const start = rule.quiet_hours_start_min;
  const end = rule.quiet_hours_end_min;
  if (start === null || end === null || start === undefined || end === undefined) return false;
  if (start === end) return false;
  if (start < end) {
    return nowLocalMinutes >= start && nowLocalMinutes < end;
  }
  // Window wraps midnight (e.g. 22:00 → 07:00)
  return nowLocalMinutes >= start || nowLocalMinutes < end;
}
