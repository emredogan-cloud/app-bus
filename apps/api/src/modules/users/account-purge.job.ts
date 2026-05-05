import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Daily job: hard-purge soft-deleted accounts whose 90-day grace has elapsed.
 *
 * "Purge" means anonymizing PII fields and clearing related identifiable rows
 * (oauth identities, refresh tokens, password reset tokens). The user row stays
 * with delete_status=purged so foreign keys / aggregate analytics remain valid.
 */
@Injectable()
export class AccountPurgeJob {
  private readonly log = new Logger(AccountPurgeJob.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { timeZone: 'Europe/Istanbul' })
  async run(): Promise<void> {
    const now = new Date();
    const due = await this.prisma.user.findMany({
      where: {
        delete_status: 'pending_purge',
        delete_purge_at: { lte: now },
      },
      select: { id: true, email: true },
    });
    if (due.length === 0) return;

    this.log.log(`purging ${due.length} accounts past KVKK grace period`);

    for (const u of due) {
      await this.prisma.$transaction([
        // Anonymize PII on the user row
        this.prisma.user.update({
          where: { id: u.id },
          data: {
            email: `purged-${u.id}@example.invalid`,
            password_hash: null,
            name: 'Purged User',
            phone_e164: null,
            email_verified: false,
            delete_status: 'purged',
            delete_purge_at: null,
          },
        }),
        // Drop linked OAuth identities
        this.prisma.oAuthIdentity.deleteMany({ where: { user_id: u.id } }),
        // Drop refresh + reset + verification tokens
        this.prisma.refreshToken.deleteMany({ where: { user_id: u.id } }),
        this.prisma.passwordResetToken.deleteMany({ where: { user_id: u.id } }),
        this.prisma.emailVerificationToken.deleteMany({ where: { user_id: u.id } }),
        // Keep KVKK consents — they are the audit trail required by law
      ]);
    }
  }
}
