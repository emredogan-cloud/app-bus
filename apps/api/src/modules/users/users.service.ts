import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RefreshTokenService } from '../auth/refresh-token.service.js';
import type { UpdateProfileDto } from './users.dto.js';
import type { Locale } from '@prisma/client';

const PURGE_GRACE_DAYS = 90;

@Injectable()
export class UsersService {
  private readonly log = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly refresh: RefreshTokenService,
  ) {}

  async getMe(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!u || u.delete_status !== 'active') throw new NotFoundException({ code: 'user_not_found' });
    return this.toPublic(u);
  }

  async updateMe(userId: string, patch: UpdateProfileDto) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: patch.name,
        locale: patch.locale as Locale | undefined,
        phone_e164: patch.phone_e164 === null ? null : patch.phone_e164,
      },
    });
    return this.toPublic(updated);
  }

  /** Soft-delete: anonymize-after-grace pattern. Refresh tokens revoked immediately. */
  async deleteMe(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        delete_status: 'pending_purge',
        delete_purge_at: new Date(Date.now() + PURGE_GRACE_DAYS * 24 * 60 * 60 * 1000),
      },
    });
    await this.refresh.revokeAllForUser(userId);
    this.log.log(
      `account ${userId} marked for purge in ${PURGE_GRACE_DAYS} days (KVKK right to erasure)`,
    );
  }

  /**
   * KVKK data export. Returns every record we hold for this user (PII + non-PII)
   * suitable for the user to download.
   */
  async exportData(userId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        oauth_identities: { select: { provider: true, email: true, created_at: true } },
        kvkk_consents: {
          select: {
            version: true,
            marketing_opt_in: true,
            accepted_at: true,
            ip: true,
            user_agent: true,
          },
        },
      },
    });
    if (!u) throw new NotFoundException({ code: 'user_not_found' });

    return {
      user: this.toPublic(u),
      oauth_identities: u.oauth_identities,
      kvkk_consents: u.kvkk_consents,
      exported_at: new Date().toISOString(),
      // Phase 2+ will add: favorite stops/routes, notification rules, notification log.
    };
  }

  private toPublic(u: {
    id: string;
    email: string;
    name: string;
    locale: Locale;
    phone_e164: string | null;
    premium_tier: 'free' | 'premium';
    email_verified: boolean;
    created_at: Date;
  }) {
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      locale: u.locale,
      phone_e164: u.phone_e164,
      premium_tier: u.premium_tier,
      email_verified: u.email_verified,
      created_at: u.created_at.toISOString(),
    };
  }
}
