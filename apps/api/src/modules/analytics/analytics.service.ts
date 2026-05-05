import { Inject, Injectable } from '@nestjs/common';

export interface AnalyticsEvent {
  /** Stable user id, or 'anonymous' for unauth events. */
  distinct_id: string;
  event: string;
  properties?: Record<string, string | number | boolean | null>;
  timestamp?: Date;
}

export interface AnalyticsAdapter {
  capture(event: AnalyticsEvent): void;
  flush(): Promise<void>;
}

export const ANALYTICS_ADAPTER = Symbol('ANALYTICS_ADAPTER');

@Injectable()
export class AnalyticsService {
  constructor(@Inject(ANALYTICS_ADAPTER) private readonly adapter: AnalyticsAdapter) {}

  capture(event: AnalyticsEvent): void {
    this.adapter.capture(event);
  }

  /** Force-flush pending events; called on graceful shutdown. */
  flush(): Promise<void> {
    return this.adapter.flush();
  }
}
