import { Global, Module } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service.js';
import { LoginThrottleService } from './login-throttle.service.js';

@Global()
@Module({
  providers: [RateLimitService, LoginThrottleService],
  exports: [RateLimitService, LoginThrottleService],
})
export class RateLimitModule {}
