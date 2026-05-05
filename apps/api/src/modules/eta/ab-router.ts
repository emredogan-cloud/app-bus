import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import type { AppEnv } from '../../config/env.js';

export type EtaVariant = 'heuristic' | 'ml';

/**
 * AbRouter — picks an ETA computation variant per (user, route) bucket.
 *
 * Phase 11 introduces an ML ETA predictor (separate inference service);
 * we A/B-test it against the Phase 5 heuristic until it consistently beats
 * the median-error target.
 *
 * Bucket assignment: stable sha256(experiment + user_id) → 0..1, partitioned
 * by `ML_ETA_TRAFFIC_PCT` (default 0). Anonymous calls always use heuristic.
 */
@Injectable()
export class AbRouter {
  private readonly log = new Logger(AbRouter.name);

  constructor(private readonly config: ConfigService<AppEnv, true>) {}

  pick(input: { userId?: string; experiment?: string }): EtaVariant {
    const pct = this.config.get('ML_ETA_TRAFFIC_PCT', { infer: true });
    if (pct <= 0 || !input.userId) return 'heuristic';

    const key = `${input.experiment ?? 'eta-ml-v1'}:${input.userId}`;
    const h = createHash('sha256').update(key).digest();
    // First 8 bytes → uint64 → 0..1 ratio
    const num = h.readBigUInt64BE(0);
    const ratio = Number(num % 10000n) / 10000;
    return ratio < pct / 100 ? 'ml' : 'heuristic';
  }
}
