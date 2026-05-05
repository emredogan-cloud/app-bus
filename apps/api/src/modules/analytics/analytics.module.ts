import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnv } from '../../config/env.js';
import { AnalyticsService, ANALYTICS_ADAPTER } from './analytics.service.js';
import { DevAnalyticsAdapter } from './adapters/dev.adapter.js';
import { PostHogAnalyticsAdapter } from './adapters/posthog.adapter.js';

@Global()
@Module({
  providers: [
    {
      provide: ANALYTICS_ADAPTER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnv, true>) => {
        const adapter = config.get('ANALYTICS_ADAPTER', { infer: true });
        const apiKey = config.get('POSTHOG_API_KEY', { infer: true });
        if (adapter === 'posthog' && apiKey) {
          return new PostHogAnalyticsAdapter({
            apiKey,
            host: config.get('POSTHOG_HOST', { infer: true }),
          });
        }
        return new DevAnalyticsAdapter();
      },
    },
    AnalyticsService,
  ],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
