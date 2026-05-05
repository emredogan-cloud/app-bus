import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { AppEnv } from '../../config/env.js';

/**
 * Verifies the shared-secret bearer token RevenueCat attaches to its webhook.
 * Constant-time compare prevents timing leaks.
 */
@Injectable()
export class RevenueCatVerifier {
  constructor(private readonly config: ConfigService<AppEnv, true>) {}

  isValid(authHeader: string | undefined): boolean {
    const expected = this.config.get('REVENUECAT_WEBHOOK_SECRET', { infer: true } as never) as
      | string
      | undefined;
    if (!expected) return false;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
    const got = authHeader.slice('Bearer '.length).trim();
    if (got.length !== expected.length) return false;
    try {
      return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
    } catch {
      return false;
    }
  }
}
