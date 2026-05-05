import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface RuleInput {
  stop_id: string;
  route_id?: string | null;
  threshold_minutes: number;
  days_of_week_bitmask?: number;
  quiet_hours_start_min?: number | null;
  quiet_hours_end_min?: number | null;
  enabled?: boolean;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.notificationRule.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });
  }

  create(userId: string, input: RuleInput) {
    return this.prisma.notificationRule.create({
      data: {
        user_id: userId,
        stop_id: input.stop_id,
        route_id: input.route_id ?? null,
        threshold_minutes: input.threshold_minutes,
        days_of_week_bitmask: input.days_of_week_bitmask ?? 127,
        quiet_hours_start_min: input.quiet_hours_start_min ?? null,
        quiet_hours_end_min: input.quiet_hours_end_min ?? null,
        enabled: input.enabled ?? true,
      },
    });
  }

  async update(userId: string, id: string, patch: Partial<RuleInput>) {
    const r = await this.prisma.notificationRule.updateMany({
      where: { id, user_id: userId },
      data: {
        stop_id: patch.stop_id,
        route_id: patch.route_id,
        threshold_minutes: patch.threshold_minutes,
        days_of_week_bitmask: patch.days_of_week_bitmask,
        quiet_hours_start_min: patch.quiet_hours_start_min,
        quiet_hours_end_min: patch.quiet_hours_end_min,
        enabled: patch.enabled,
      },
    });
    if (r.count === 0) throw new NotFoundException({ code: 'rule_not_found' });
    return this.prisma.notificationRule.findUnique({ where: { id } });
  }

  async remove(userId: string, id: string) {
    const r = await this.prisma.notificationRule.deleteMany({
      where: { id, user_id: userId },
    });
    if (r.count === 0) throw new NotFoundException({ code: 'rule_not_found' });
  }

  /** Last 30 days of notification log entries for the in-app center. */
  recentLog(userId: string, limit = 50) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return this.prisma.notificationLog.findMany({
      where: { user_id: userId, created_at: { gte: since } },
      orderBy: { created_at: 'desc' },
      take: Math.min(limit, 200),
    });
  }
}
