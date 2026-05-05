import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuthService, type AuthResult } from '../auth.service.js';
import { GoogleVerifier } from './google.verifier.js';
import { AppleVerifier } from './apple.verifier.js';
import type { AppEnv } from '../../../config/env.js';
import type { OAuthProvider } from '@prisma/client';

interface OAuthInput {
  idToken: string;
  kvkkConsentVersion?: string;
  marketingOptIn: boolean;
  userAgent?: string;
  ip?: string;
}

@Injectable()
export class OAuthService {
  private readonly log = new Logger(OAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly google: GoogleVerifier,
    private readonly apple: AppleVerifier,
    private readonly config: ConfigService<AppEnv, true>,
  ) {}

  async signInWithGoogle(input: OAuthInput): Promise<AuthResult> {
    const claims = await this.google.verify(input.idToken);
    return this.upsertAndIssue('google', {
      providerUserId: claims.sub,
      email: claims.email ?? null,
      emailVerified: claims.email_verified ?? false,
      name: claims.name ?? claims.given_name ?? 'New user',
      locale: (claims.locale ?? 'tr').startsWith('tr') ? 'tr' : 'en',
      kvkkConsentVersion: input.kvkkConsentVersion,
      marketingOptIn: input.marketingOptIn,
      userAgent: input.userAgent,
      ip: input.ip,
    });
  }

  async signInWithApple(input: OAuthInput): Promise<AuthResult> {
    const claims = await this.apple.verify(input.idToken);
    return this.upsertAndIssue('apple', {
      providerUserId: claims.sub,
      email: claims.email ?? null,
      emailVerified: claims.email_verified ?? false,
      // Apple doesn't include name on subsequent sign-ins; use a placeholder if missing.
      name: claims.name ?? 'New user',
      locale: 'tr',
      kvkkConsentVersion: input.kvkkConsentVersion,
      marketingOptIn: input.marketingOptIn,
      userAgent: input.userAgent,
      ip: input.ip,
    });
  }

  private async upsertAndIssue(
    provider: OAuthProvider,
    args: {
      providerUserId: string;
      email: string | null;
      emailVerified: boolean;
      name: string;
      locale: 'tr' | 'en';
      kvkkConsentVersion?: string;
      marketingOptIn: boolean;
      userAgent?: string;
      ip?: string;
    },
  ): Promise<AuthResult> {
    const expectedKvkkVersion = this.config.get('KVKK_CURRENT_VERSION', { infer: true });

    // Existing identity?
    const existing = await this.prisma.oAuthIdentity.findUnique({
      where: {
        provider_provider_user_id: {
          provider,
          provider_user_id: args.providerUserId,
        },
      },
      include: { user: true },
    });
    if (existing) {
      if (existing.user.delete_status !== 'active') {
        throw new UnauthorizedException({ code: 'account_disabled' });
      }
      return this.auth.issueTokens(existing.user, {
        userAgent: args.userAgent,
        ip: args.ip,
      });
    }

    // No identity yet. Auto-link by email if a verified-email-account exists; otherwise create.
    if (!args.email) {
      throw new UnauthorizedException({ code: 'oauth_missing_email' });
    }

    // For first-time OAuth, KVKK consent is required.
    if (!args.kvkkConsentVersion) {
      throw new ConflictException({
        code: 'kvkk_consent_required',
        detail: `client must include kvkk_consent_version=${expectedKvkkVersion}`,
        kvkk_version: expectedKvkkVersion,
      });
    }
    if (args.kvkkConsentVersion !== expectedKvkkVersion) {
      throw new ConflictException({
        code: 'kvkk_version_mismatch',
        kvkk_version: expectedKvkkVersion,
      });
    }

    const linked = await this.prisma.user.findUnique({ where: { email: args.email } });
    if (linked) {
      if (linked.delete_status !== 'active') {
        throw new UnauthorizedException({ code: 'account_disabled' });
      }
      await this.prisma.oAuthIdentity.create({
        data: {
          user_id: linked.id,
          provider,
          provider_user_id: args.providerUserId,
          email: args.email,
        },
      });
      this.log.log(`linked OAuth identity provider=${provider} to existing user=${linked.id}`);
      return this.auth.issueTokens(linked, { userAgent: args.userAgent, ip: args.ip });
    }

    // New user — create with linked identity + KVKK record in one transaction.
    const created = await this.prisma.user.create({
      data: {
        email: args.email,
        name: args.name,
        locale: args.locale,
        email_verified: args.emailVerified,
        oauth_identities: {
          create: {
            provider,
            provider_user_id: args.providerUserId,
            email: args.email,
          },
        },
        kvkk_consents: {
          create: {
            version: args.kvkkConsentVersion,
            marketing_opt_in: args.marketingOptIn,
            ip: args.ip,
            user_agent: args.userAgent,
          },
        },
      },
    });
    return this.auth.issueTokens(created, { userAgent: args.userAgent, ip: args.ip });
  }
}
