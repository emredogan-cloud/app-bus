import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AppEnv } from '../../config/env.js';

/**
 * Refresh token format (opaque to client): "<rt-id-uuid>.<base64url-secret>"
 * - id is the DB row id (lookup key)
 * - secret is the random material we hash for verification
 *
 * On refresh:
 *   1. Look up by id, verify hash(secret) matches token_hash and !revoked && !rotated && !expired
 *   2. Mark this token rotated_at=now, issue a new token in the SAME family
 *   3. If we ever see a refresh request whose token_hash maps to a row that is already
 *      rotated_at!=null OR revoked_at!=null, we treat it as theft → revoke entire family
 */

export interface IssuedRefresh {
  token: string;
  familyId: string;
  expiresAt: Date;
  recordId: string;
}

@Injectable()
export class RefreshTokenService {
  private readonly log = new Logger(RefreshTokenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppEnv, true>,
  ) {}

  async issue(input: {
    userId: string;
    familyId?: string;
    userAgent?: string | null;
    ip?: string | null;
  }): Promise<IssuedRefresh> {
    const ttl = this.config.get('JWT_REFRESH_TTL_SECONDS', { infer: true });
    const expiresAt = new Date(Date.now() + ttl * 1000);
    const familyId = input.familyId ?? randomUUID();
    const id = randomUUID();
    const secret = randomBytes(32).toString('base64url');
    const tokenHash = sha256(`${id}.${secret}`);

    await this.prisma.refreshToken.create({
      data: {
        id,
        user_id: input.userId,
        family_id: familyId,
        token_hash: tokenHash,
        expires_at: expiresAt,
        user_agent: input.userAgent ?? null,
        ip: input.ip ?? null,
      },
    });

    return {
      token: `${id}.${secret}`,
      familyId,
      expiresAt,
      recordId: id,
    };
  }

  /**
   * Atomically rotate a refresh token. Returns the new (token, familyId) on success.
   * Throws on:
   *   - bad format
   *   - unknown id
   *   - hash mismatch
   *   - already rotated  (theft → entire family revoked)
   *   - revoked          (theft → entire family revoked, idempotent)
   *   - expired
   */
  async rotate(input: {
    presented: string;
    userAgent?: string | null;
    ip?: string | null;
  }): Promise<IssuedRefresh & { userId: string }> {
    const parts = input.presented.split('.');
    if (parts.length !== 2) throw new Error('refresh_token_malformed');
    const [id, secret] = parts;

    const presentedHash = sha256(`${id}.${secret}`);

    return this.prisma.$transaction(async (tx) => {
      const row = await tx.refreshToken.findUnique({ where: { id } });
      if (!row) throw new Error('refresh_token_unknown');
      if (row.token_hash !== presentedHash) throw new Error('refresh_token_hash_mismatch');

      // Theft / replay attempt: token was already rotated or revoked.
      if (row.rotated_at || row.revoked_at) {
        await tx.refreshToken.updateMany({
          where: { family_id: row.family_id, revoked_at: null },
          data: { revoked_at: new Date() },
        });
        this.log.warn(`refresh-token reuse detected — revoked family ${row.family_id}`);
        throw new Error('refresh_token_reuse');
      }

      if (row.expires_at.getTime() < Date.now()) {
        throw new Error('refresh_token_expired');
      }

      // Issue successor in same family, mark this one rotated.
      const successorId = randomUUID();
      const successorSecret = randomBytes(32).toString('base64url');
      const successorHash = sha256(`${successorId}.${successorSecret}`);
      const ttl = this.config.get('JWT_REFRESH_TTL_SECONDS', { infer: true });
      const successorExpires = new Date(Date.now() + ttl * 1000);

      await tx.refreshToken.update({
        where: { id: row.id },
        data: { rotated_at: new Date() },
      });
      await tx.refreshToken.create({
        data: {
          id: successorId,
          user_id: row.user_id,
          family_id: row.family_id,
          token_hash: successorHash,
          expires_at: successorExpires,
          user_agent: input.userAgent ?? null,
          ip: input.ip ?? null,
        },
      });

      return {
        token: `${successorId}.${successorSecret}`,
        familyId: row.family_id,
        expiresAt: successorExpires,
        recordId: successorId,
        userId: row.user_id,
      };
    });
  }

  /** Revoke a single refresh token by presented value (used on logout). Tolerant: silent if unknown. */
  async revokePresented(presented: string): Promise<void> {
    const parts = presented.split('.');
    if (parts.length !== 2) return;
    const id = parts[0];
    await this.prisma.refreshToken.updateMany({
      where: { id, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }

  /** Revoke every active refresh token for a user (used on password reset, account deletion). */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { user_id: userId, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}
