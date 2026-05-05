import { Global, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis, { Redis } from 'ioredis';
import type { AppEnv } from '../../config/env.js';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnv, true>) => {
        const url = config.get('REDIS_URL', { infer: true });
        const log = new Logger('RedisProvider');
        if (!url) {
          log.warn('REDIS_URL not set — using in-memory shim. Production MUST set REDIS_URL.');
          return null;
        }
        const client = new IORedis(url, {
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          lazyConnect: false,
        });
        client.on('error', (err) => log.error(`redis error: ${err.message}`));
        client.on('connect', () => log.log('redis connected'));
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    // Shutdown handled by ioredis + Nest's app.enableShutdownHooks();
  }
}

export type RedisLike = Redis | null;
