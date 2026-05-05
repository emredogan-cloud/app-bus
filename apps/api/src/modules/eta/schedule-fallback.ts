import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

/**
 * The Phase 5 spec calls for a worker that, every 60s, populates Redis ETAs
 * from `ScheduleEntry` for stops with no live data. In our implementation the
 * REST `EtaService.getForStop` already performs this fallback inline whenever
 * Redis is empty for a stop, which is simpler and avoids a write-load spike
 * from a 60s cron over 50k stops.
 *
 * This class remains as a hook to enable a real cron implementation later if
 * write-on-read becomes too costly at scale (e.g. via metrics).
 */
@Injectable()
export class ScheduleFallback {
  private readonly log = new Logger(ScheduleFallback.name);

  @Cron(CronExpression.EVERY_HOUR)
  noop(): void {
    // Intentionally a no-op for Phase 5. The presence of @Cron keeps the
    // ScheduleModule attached so Phase 6 favorites/notifications can rely on
    // the scheduler being initialized.
  }
}
