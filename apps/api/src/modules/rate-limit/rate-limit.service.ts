import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module.js';

/**
 * Token-bucket rate limiter on Redis (or an in-memory shim when Redis is unavailable).
 *
 * The bucket holds at most `capacity` tokens and refills at `refillPerSec`.
 * Each `consume` call costs 1 token.
 *
 * Returns:
 *   - `allowed: true` and the remaining tokens, OR
 *   - `allowed: false` and the seconds the caller should wait.
 *
 * Implementation is the standard "stored timestamp + token count" approach so we
 * can do it atomically with a single Lua script in Redis.
 */
const LUA = `
local key = KEYS[1]
local now_ms = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local refill_per_sec = tonumber(ARGV[3])
local cost = tonumber(ARGV[4])

local data = redis.call('HMGET', key, 'tokens', 'updated_ms')
local tokens = tonumber(data[1])
local updated = tonumber(data[2])

if tokens == nil then
  tokens = capacity
  updated = now_ms
end

local elapsed_sec = (now_ms - updated) / 1000.0
tokens = math.min(capacity, tokens + elapsed_sec * refill_per_sec)

local allowed = 0
if tokens >= cost then
  tokens = tokens - cost
  allowed = 1
end

redis.call('HMSET', key, 'tokens', tokens, 'updated_ms', now_ms)
redis.call('PEXPIRE', key, math.ceil((capacity / refill_per_sec) * 1000) + 1000)

local retry_after_ms = 0
if allowed == 0 then
  retry_after_ms = math.ceil((cost - tokens) / refill_per_sec * 1000)
end

return {allowed, math.floor(tokens), retry_after_ms}
`;

interface InMemoryBucket {
  tokens: number;
  updatedMs: number;
}

@Injectable()
export class RateLimitService {
  private readonly log = new Logger(RateLimitService.name);
  private readonly memory = new Map<string, InMemoryBucket>();

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis | null) {}

  async consume(input: {
    key: string;
    capacity: number;
    refillPerSec: number;
    cost?: number;
  }): Promise<{ allowed: boolean; remaining: number; retryAfterMs: number }> {
    const cost = input.cost ?? 1;
    if (this.redis) {
      try {
        const res = (await this.redis.eval(
          LUA,
          1,
          input.key,
          Date.now().toString(),
          input.capacity.toString(),
          input.refillPerSec.toString(),
          cost.toString(),
        )) as [number, number, number];
        return { allowed: res[0] === 1, remaining: res[1], retryAfterMs: res[2] };
      } catch (err) {
        this.log.error(
          `redis rate-limit failed, falling back to in-memory: ${(err as Error).message}`,
        );
        // Fall through to in-memory.
      }
    }
    return this.consumeInMemory(input.key, input.capacity, input.refillPerSec, cost);
  }

  private consumeInMemory(
    key: string,
    capacity: number,
    refillPerSec: number,
    cost: number,
  ): { allowed: boolean; remaining: number; retryAfterMs: number } {
    const now = Date.now();
    const bucket = this.memory.get(key) ?? { tokens: capacity, updatedMs: now };
    const elapsedSec = (now - bucket.updatedMs) / 1000;
    bucket.tokens = Math.min(capacity, bucket.tokens + elapsedSec * refillPerSec);
    bucket.updatedMs = now;
    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      this.memory.set(key, bucket);
      return { allowed: true, remaining: Math.floor(bucket.tokens), retryAfterMs: 0 };
    }
    const retryAfterMs = Math.ceil(((cost - bucket.tokens) / refillPerSec) * 1000);
    this.memory.set(key, bucket);
    return { allowed: false, remaining: Math.floor(bucket.tokens), retryAfterMs };
  }
}
