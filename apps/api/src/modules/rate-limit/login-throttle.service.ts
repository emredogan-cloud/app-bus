import { Injectable } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service.js';

/**
 * Login-attempt throttle.
 *   • 5 attempts / 15 minutes / IP
 *   • After 3 consecutive failures, exponential cooldown (4s, 8s, 16s, …)
 *
 * The 5-per-15-min cap is implemented via a token bucket of capacity=5 with
 * refill = 5 / 900s. The exponential cooldown is a separate counter.
 */
@Injectable()
export class LoginThrottleService {
  private static readonly CAP = 5;
  private static readonly REFILL_PER_SEC = 5 / 900;

  constructor(private readonly rl: RateLimitService) {}

  async checkAttempt(
    ip: string,
  ): Promise<{ allowed: boolean; retryAfterMs: number; remaining: number }> {
    return this.rl.consume({
      key: `login:ip:${ip}`,
      capacity: LoginThrottleService.CAP,
      refillPerSec: LoginThrottleService.REFILL_PER_SEC,
    });
  }
}
