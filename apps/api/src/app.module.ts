import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { TerminusModule } from '@nestjs/terminus';
import { validateEnv } from './config/env.js';
import { HealthModule } from './modules/health/health.module.js';
import { PrismaModule } from './modules/prisma/prisma.module.js';
import { CryptoModule } from './modules/crypto/crypto.module.js';
import { JwtModule } from './modules/jwt/jwt.module.js';
import { RedisModule } from './modules/redis/redis.module.js';
import { RateLimitModule } from './modules/rate-limit/rate-limit.module.js';
import { MessagingModule } from './modules/messaging/messaging.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { AuthGuard } from './modules/auth/auth.guard.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      envFilePath: ['.env.local', '.env'],
    }),
    LoggerModule.forRootAsync({
      useFactory: () => ({
        pinoHttp: {
          level: process.env.LOG_LEVEL ?? 'info',
          transport:
            process.env.NODE_ENV !== 'production'
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.body.password',
              'req.body.new_password',
              'req.body.refresh_token',
              'req.body.id_token',
              'res.headers["set-cookie"]',
            ],
            censor: '[REDACTED]',
          },
          customProps: () => ({ service: 'api' }),
        },
      }),
    }),
    TerminusModule,
    PrismaModule,
    CryptoModule,
    JwtModule,
    RedisModule,
    RateLimitModule,
    MessagingModule,
    HealthModule,
    AuthModule,
    UsersModule,
  ],
  providers: [
    // Global guard: every endpoint requires auth unless decorated with @Public().
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
