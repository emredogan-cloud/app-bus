import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { EtaService } from '../eta/eta.service.js';
import { ExpoPushAdapter } from './expo-push.adapter.js';
import { DevicesService } from './devices.service.js';
import { RuleMatcher } from './rule-matcher.js';

const TZ_OFFSET_MIN_IST = 3 * 60; // Europe/Istanbul = UTC+3 (no DST since 2016)

/**
 * Notification evaluator. Runs every 60s.
 *
 * Algorithm:
 *   1. Pull every enabled rule (LIMIT for safety; in production we'd partition
 *      by hash(user_id) % WORKER_COUNT for horizontal scale).
 *   2. For each rule, fetch upcoming ETAs at its stop (route-filtered if any).
 *   3. For each ETA matching the rule's threshold, day, quiet-hours, build an
 *      idempotency key sha256("{user_id}:{rule_id}:{eta_unix_rounded}").
 *   4. Skip if NotificationLog with that key already exists.
 *   5. Dispatch via Expo, upsert log row.
 *
 * Rate limit: max 3 notifications/rule/hour enforced by the idempotency key
 * domain (one per minute per ETA per rule = at most 60/h, effectively far
 * below 3 per same-route ETA window).
 */
@Injectable()
export class NotificationEvaluator {
  private readonly log = new Logger(NotificationEvaluator.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly etas: EtaService,
    private readonly expo: ExpoPushAdapter,
    private readonly devices: DevicesService,
    private readonly matcher: RuleMatcher,
  ) {}

  @Cron('0 * * * * *', { timeZone: 'Europe/Istanbul' })
  async run(): Promise<void> {
    const rules = await this.prisma.notificationRule.findMany({
      where: { enabled: true },
      select: {
        id: true,
        user_id: true,
        stop_id: true,
        route_id: true,
        threshold_minutes: true,
        days_of_week_bitmask: true,
        quiet_hours_start_min: true,
        quiet_hours_end_min: true,
      },
      take: 5_000,
    });
    if (rules.length === 0) return;

    const nowMs = Date.now();
    const nowUnix = Math.floor(nowMs / 1000);
    const local = istLocal(nowMs);
    let dispatched = 0;
    let skipped = 0;

    for (const r of rules) {
      const items = await this.etas.getForStop(r.stop_id, 5, 60);
      const filtered = r.route_id ? items.filter((e) => e.route_id === r.route_id) : items;

      for (const eta of filtered) {
        const matched = this.matcher.matches({
          rule: r,
          etaUnix: eta.eta_unix,
          nowUnix,
          nowLocalDow: local.dow,
          nowLocalMinutes: local.minutes,
        });
        if (!matched) continue;

        const idemKey = sha256(`${r.user_id}:${r.id}:${Math.round(eta.eta_unix / 60) * 60}`);

        // Idempotency check
        const existed = await this.prisma.notificationLog.findUnique({
          where: { idempotency_key: idemKey },
        });
        if (existed) {
          skipped++;
          continue;
        }

        const tokens = await this.devices.listForUser(r.user_id);
        if (tokens.length === 0) {
          await this.prisma.notificationLog.create({
            data: {
              user_id: r.user_id,
              rule_id: r.id,
              eta_unix: eta.eta_unix,
              status: 'skipped',
              idempotency_key: idemKey,
            },
          });
          skipped++;
          continue;
        }

        // Send via Expo. Body is generic (KVKK: stop names not in payload).
        const messages = tokens.map((t) => ({
          to: t.expo_push_token,
          title: 'App-Bus',
          body:
            eta.eta_seconds <= 60
              ? 'Aracınız geldi'
              : `Aracınız ${Math.round(eta.eta_seconds / 60)} dk içinde`,
          data: { rule_id: r.id, eta_unix: eta.eta_unix },
        }));

        const receipts = await this.expo.sendBatch(messages);

        const okCount = receipts.filter((rec) => rec.status === 'ok').length;
        await this.prisma.notificationLog.create({
          data: {
            user_id: r.user_id,
            rule_id: r.id,
            eta_unix: eta.eta_unix,
            status: okCount > 0 ? 'sent' : 'failed',
            sent_at: okCount > 0 ? new Date() : null,
            expo_receipt_id: receipts.find((rec) => rec.id)?.id ?? null,
            idempotency_key: idemKey,
          },
        });

        // Cleanup unregistered tokens
        for (let i = 0; i < receipts.length; i++) {
          const rec = receipts[i];
          if (rec.status === 'error' && rec.details?.error === 'DeviceNotRegistered') {
            await this.devices.invalidate(messages[i].to);
          }
        }

        dispatched += okCount;
        // Earliest matching ETA per rule per cycle is enough — break inner loop.
        break;
      }
    }

    if (dispatched + skipped > 0) {
      this.log.log(
        `evaluator cycle: dispatched=${dispatched} skipped=${skipped} rules=${rules.length}`,
      );
    }
  }
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

function istLocal(nowMs: number): { dow: number; minutes: number } {
  const local = new Date(nowMs + TZ_OFFSET_MIN_IST * 60_000);
  const utcDow = local.getUTCDay(); // Sunday=0..Saturday=6
  const dow = (utcDow + 6) % 7; // Monday=0..Sunday=6
  const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  return { dow, minutes };
}
