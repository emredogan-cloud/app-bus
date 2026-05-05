import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller.js';
import { RevenueCatWebhookController } from './revenuecat-webhook.controller.js';
import { BillingService } from './billing.service.js';
import { RevenueCatVerifier } from './revenuecat-verifier.js';

@Module({
  controllers: [BillingController, RevenueCatWebhookController],
  providers: [BillingService, RevenueCatVerifier],
  exports: [BillingService],
})
export class BillingModule {}
