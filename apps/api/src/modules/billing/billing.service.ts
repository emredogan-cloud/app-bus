import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * BillingService — single point that flips a User's premium_tier in response
 * to a verified RevenueCat event (or a manual operator action).
 */
@Injectable()
export class BillingService {
  private readonly log = new Logger(BillingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async setTier(userId: string, tier: 'free' | 'premium', reason: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { premium_tier: tier },
    });
    this.log.log(`user ${userId} → ${tier} (${reason})`);
  }

  /**
   * Apply a RevenueCat event. Public on purpose so the webhook handler can
   * call it after signature verification.
   *
   * Supported event types (per RevenueCat docs):
   *   INITIAL_PURCHASE, RENEWAL, NON_RENEWING_PURCHASE, CANCELLATION,
   *   EXPIRATION, BILLING_ISSUE, PRODUCT_CHANGE, SUBSCRIBER_ALIAS, TRANSFER
   */
  async applyEvent(event: {
    type: string;
    app_user_id: string;
    product_id?: string;
    expiration_at_ms?: number | null;
  }): Promise<void> {
    const tierFromEvent = (): 'free' | 'premium' => {
      switch (event.type) {
        case 'INITIAL_PURCHASE':
        case 'RENEWAL':
        case 'PRODUCT_CHANGE':
        case 'NON_RENEWING_PURCHASE':
        case 'UNCANCELLATION':
          return 'premium';
        case 'CANCELLATION':
          // Cancellation by itself doesn't downgrade — user keeps Premium until expiration.
          return 'premium';
        case 'EXPIRATION':
        case 'BILLING_ISSUE':
          return 'free';
        default:
          return 'free';
      }
    };

    // app_user_id is whatever the mobile client passed to RevenueCat.
    // We use User.id (UUID) on the client side.
    const user = await this.prisma.user.findUnique({ where: { id: event.app_user_id } });
    if (!user) {
      this.log.warn(`RevenueCat event for unknown user_id=${event.app_user_id} type=${event.type}`);
      return;
    }
    await this.setTier(user.id, tierFromEvent(), `revenuecat:${event.type}`);
  }
}
