import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnv } from '../../config/env.js';

interface FlagEvaluationContext {
  userId?: string;
  premiumTier?: 'free' | 'premium';
  city?: 'IST' | 'ANK' | 'IZM' | 'BUR' | 'ANT';
}

/**
 * Feature flag adapter — defaults to a static config map; swappable to
 * GrowthBook (self-hosted) by setting `GROWTHBOOK_API_HOST`.
 *
 * Most flags are simple booleans gated by environment + tier. The static map
 * lives in env (`FEATURE_FLAGS_JSON`) for low-risk toggles like
 * `crowd_reports_enabled`. Full GrowthBook wiring lands when the
 * experimentation stack is provisioned.
 */
@Injectable()
export class FeatureFlagsService {
  private readonly log = new Logger(FeatureFlagsService.name);
  private readonly staticFlags: Record<string, boolean>;

  constructor(private readonly config: ConfigService<AppEnv, true>) {
    const raw = this.config.get('FEATURE_FLAGS_JSON', { infer: true });
    try {
      this.staticFlags = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    } catch {
      this.log.warn('FEATURE_FLAGS_JSON is not valid JSON; ignoring');
      this.staticFlags = {};
    }
  }

  isEnabled(flag: string, ctx: FlagEvaluationContext = {}): boolean {
    // Premium gates
    if (flag === 'biometric_unlock') return ctx.premiumTier === 'premium';
    if (flag === 'unlimited_favorites') return ctx.premiumTier === 'premium';
    if (flag === 'ad_free') return ctx.premiumTier === 'premium';

    // Static map fallback (operator-managed via env)
    return this.staticFlags[flag] ?? false;
  }
}
