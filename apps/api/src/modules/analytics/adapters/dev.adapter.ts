import { Logger } from '@nestjs/common';
import type { AnalyticsAdapter, AnalyticsEvent } from '../analytics.service.js';

export class DevAnalyticsAdapter implements AnalyticsAdapter {
  private readonly log = new Logger(DevAnalyticsAdapter.name);

  capture(e: AnalyticsEvent): void {
    if (process.env.NODE_ENV === 'test') return;
    this.log.debug(`[analytics] ${e.event} ${e.distinct_id} ${JSON.stringify(e.properties ?? {})}`);
  }
  async flush(): Promise<void> {
    /* no-op */
  }
}
