import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard, type AuthedRequest } from '../auth/auth.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Lightweight read endpoint the mobile paywall uses to render entitlements.
 * The source of truth for "is the user Premium" is `User.premium_tier`,
 * updated by the RevenueCat webhook handler.
 */
@ApiTags('billing')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('users/me/entitlements')
export class BillingController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async get(@Req() req: AuthedRequest) {
    const u = await this.prisma.user.findUnique({
      where: { id: req.user!.sub },
      select: { premium_tier: true },
    });
    return {
      tier: u?.premium_tier ?? 'free',
      features: {
        ad_free: u?.premium_tier === 'premium',
        unlimited_favorites: u?.premium_tier === 'premium',
        biometric_unlock: u?.premium_tier === 'premium',
      },
    };
  }
}
