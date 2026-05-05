import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/auth.guard.js';
import { BillingService } from './billing.service.js';
import { RevenueCatVerifier } from './revenuecat-verifier.js';

interface RcEventBody {
  event?: {
    type?: string;
    app_user_id?: string;
    product_id?: string;
    expiration_at_ms?: number | null;
    original_app_user_id?: string;
  };
}

@ApiTags('billing')
@Controller('billing/revenuecat-webhook')
export class RevenueCatWebhookController {
  constructor(
    private readonly billing: BillingService,
    private readonly verifier: RevenueCatVerifier,
  ) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  async receive(
    @Headers('authorization') auth: string | undefined,
    @Body() body: RcEventBody,
  ): Promise<void> {
    if (!this.verifier.isValid(auth)) {
      throw new UnauthorizedException({ code: 'invalid_webhook_secret' });
    }
    const e = body?.event;
    if (!e?.type || !e.app_user_id) {
      // Malformed; respond 204 to prevent RevenueCat retries on schema drift.
      return;
    }
    await this.billing.applyEvent({
      type: e.type,
      app_user_id: e.app_user_id,
      product_id: e.product_id,
      expiration_at_ms: e.expiration_at_ms ?? null,
    });
  }
}
