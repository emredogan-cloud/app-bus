import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Confidence } from './eta.calculator.js';

export interface EtaRow {
  route_id: string;
  route_code: string;
  headsign: string | null;
  vehicle_id: string | null;
  eta_unix: number;
  eta_seconds: number;
  confidence: Confidence;
  source: 'live' | 'schedule';
}

/**
 * Read-side service used by the REST endpoint and the WS bridge. Reads ETAs
 * from Redis ZSET (etas:stop:{stop_id}) — populated by the worker — and
 * decorates each row with route metadata for client display.
 */
@Injectable()
export class EtaService {
  private readonly log = new Logger(EtaService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
    private readonly prisma: PrismaService,
  ) {}

  async getForStop(stopId: string, limit = 10, horizonMin = 60): Promise<EtaRow[]> {
    if (!this.redis) {
      // Without Redis we can only serve schedule-based ETAs (Phase 5 fallback path).
      return this.getScheduleEtas(stopId, limit, horizonMin);
    }
    const now = Math.floor(Date.now() / 1000);
    const max = now + horizonMin * 60;
    const raw = await this.redis.zrangebyscore(`etas:stop:${stopId}`, now, max, 'LIMIT', 0, limit);

    const rows: EtaRow[] = [];
    for (const r of raw) {
      try {
        const parsed = JSON.parse(r) as EtaRow;
        rows.push(parsed);
      } catch {
        // skip
      }
    }

    if (rows.length === 0) return this.getScheduleEtas(stopId, limit, horizonMin);
    return rows;
  }

  /**
   * Fallback when no live ETAs are populated: turn the next N schedule entries
   * for this stop today into ETA rows tagged 'schedule' with confidence='low'.
   */
  private async getScheduleEtas(
    stopId: string,
    limit: number,
    horizonMin: number,
  ): Promise<EtaRow[]> {
    const now = new Date();
    const dow = (now.getDay() + 6) % 7; // bit 0 = monday
    const dowMask = 1 << dow;

    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const secondsNow = Math.floor((now.getTime() - startOfDay.getTime()) / 1000);

    const entries = await this.prisma.scheduleEntry.findMany({
      where: {
        stop_id: stopId,
        // Bitmask: this is a portable approximation; in raw SQL we'd use & operator,
        // but Prisma doesn't expose bitwise ops cleanly. We post-filter in JS.
        departure_seconds_from_midnight: { gte: secondsNow, lte: secondsNow + horizonMin * 60 },
      },
      orderBy: { departure_seconds_from_midnight: 'asc' },
      take: limit * 5, // over-fetch then filter
      select: {
        departure_seconds_from_midnight: true,
        days_of_week: true,
        route: { select: { id: true, code: true } },
      },
    });

    const rows: EtaRow[] = [];
    for (const e of entries) {
      if ((e.days_of_week & dowMask) === 0) continue;
      const eta_unix = Math.floor(startOfDay.getTime() / 1000) + e.departure_seconds_from_midnight;
      rows.push({
        route_id: e.route.id,
        route_code: e.route.code,
        headsign: null,
        vehicle_id: null,
        eta_unix,
        eta_seconds: e.departure_seconds_from_midnight - secondsNow,
        confidence: 'low',
        source: 'schedule',
      });
      if (rows.length >= limit) break;
    }
    return rows;
  }

  async writeLive(stopId: string, row: EtaRow): Promise<void> {
    if (!this.redis) return;
    const key = `etas:stop:${stopId}`;
    await this.redis
      .multi()
      .zadd(key, row.eta_unix, JSON.stringify(row))
      // Trim to upcoming-only and cap at 100 to bound memory
      .zremrangebyscore(key, 0, Math.floor(Date.now() / 1000) - 30)
      .zremrangebyrank(key, 0, -101)
      .expire(key, 5 * 60)
      .exec();
  }
}
