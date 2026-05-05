import { Logger } from '@nestjs/common';
import type { AnalyticsAdapter, AnalyticsEvent } from '../analytics.service.js';

/**
 * PostHog adapter — buffers events and flushes in batches of 100 every 5s
 * (or on flush()).
 *
 * Uses the PostHog batch capture endpoint. Self-hosted PostHog in eu-central-1
 * (KVKK-friendly) is the planned production deploy; PostHog Cloud EU is a
 * fallback if self-hosting is delayed.
 */
export class PostHogAnalyticsAdapter implements AnalyticsAdapter {
  private readonly log = new Logger(PostHogAnalyticsAdapter.name);
  private readonly endpoint: string;
  private readonly buffer: AnalyticsEvent[] = [];
  private readonly batchSize = 100;
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly opts: { apiKey: string; host?: string }) {
    this.endpoint = `${(opts.host ?? 'https://eu.i.posthog.com').replace(/\/$/, '')}/batch`;
    this.timer = setInterval(() => this.flush().catch(() => undefined), 5000);
    this.timer.unref?.();
  }

  capture(e: AnalyticsEvent): void {
    this.buffer.push(e);
    if (this.buffer.length >= this.batchSize) {
      void this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const batch = this.buffer.splice(0, this.buffer.length);
    if (process.env.NODE_ENV === 'test') return;
    try {
      await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          api_key: this.opts.apiKey,
          batch: batch.map((e) => ({
            event: e.event,
            distinct_id: e.distinct_id,
            properties: e.properties ?? {},
            timestamp: (e.timestamp ?? new Date()).toISOString(),
          })),
        }),
      });
    } catch (err) {
      this.log.warn(`posthog flush failed: ${(err as Error).message}`);
      // Drop on failure — analytics is best-effort.
    }
  }
}
