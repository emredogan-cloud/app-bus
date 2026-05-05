import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwtService } from '../jwt/jwt.service.js';
import { PasswordHasher } from '../crypto/password-hasher.service.js';
import { RefreshTokenService } from './refresh-token.service.js';
import { EmailService } from '../messaging/email.service.js';
import type { AppEnv } from '../../config/env.js';
import type { Locale } from '@prisma/client';

export interface AuthResult {
  user: {
    id: string;
    email: string;
    name: string;
    locale: Locale;
    premium_tier: 'free' | 'premium';
    email_verified: boolean;
  };
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
}

@Injectable()
export class AuthService {
  private readonly log = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly hasher: PasswordHasher,
    private readonly refresh: RefreshTokenService,
    private readonly email: EmailService,
    private readonly config: ConfigService<AppEnv, true>,
  ) {}

  async register(input: {
    email: string;
    password: string;
    name: string;
    locale: Locale;
    kvkkConsentVersion: string;
    marketingOptIn: boolean;
    userAgent?: string;
    ip?: string;
  }): Promise<AuthResult> {
    const expectedVersion = this.config.get('KVKK_CURRENT_VERSION', { infer: true });
    if (input.kvkkConsentVersion !== expectedVersion) {
      throw new ConflictException({
        code: 'kvkk_version_mismatch',
        detail: `expected ${expectedVersion}, got ${input.kvkkConsentVersion}`,
      });
    }

    const hash = await this.hasher.hash(input.password);

    let user;
    try {
      user = await this.prisma.user.create({
        data: {
          email: input.email,
          password_hash: hash,
          name: input.name,
          locale: input.locale,
          kvkk_consents: {
            create: {
              version: input.kvkkConsentVersion,
              marketing_opt_in: input.marketingOptIn,
              ip: input.ip,
              user_agent: input.userAgent,
            },
          },
        },
      });
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') {
        throw new ConflictException({ code: 'email_taken' });
      }
      throw err;
    }

    // Email verification token (sha256 stored, plaintext sent in URL)
    const verifyToken = randomBytes(32).toString('base64url');
    const verifyHash = sha256(verifyToken);
    await this.prisma.emailVerificationToken.create({
      data: {
        user_id: user.id,
        token_hash: verifyHash,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    await this.email.sendVerification({
      to: user.email,
      token: verifyToken,
      locale: user.locale,
    });

    return this.issueTokens(user, { userAgent: input.userAgent, ip: input.ip });
  }

  async login(input: {
    email: string;
    password: string;
    userAgent?: string;
    ip?: string;
  }): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    const ok = await this.hasher.verify(user?.password_hash, input.password);
    if (!user || !ok || user.delete_status !== 'active') {
      // Same response in either case: no user enumeration via timing/text.
      throw new UnauthorizedException({ code: 'invalid_credentials' });
    }
    return this.issueTokens(user, { userAgent: input.userAgent, ip: input.ip });
  }

  async refreshSession(input: {
    refreshToken: string;
    userAgent?: string;
    ip?: string;
  }): Promise<AuthResult> {
    let rotated;
    try {
      rotated = await this.refresh.rotate({
        presented: input.refreshToken,
        userAgent: input.userAgent,
        ip: input.ip,
      });
    } catch (err) {
      throw new UnauthorizedException({ code: (err as Error).message });
    }
    const user = await this.prisma.user.findUnique({ where: { id: rotated.userId } });
    if (!user || user.delete_status !== 'active') {
      throw new UnauthorizedException({ code: 'user_not_found' });
    }
    const access = await this.jwt.signAccessToken({
      userId: user.id,
      email: user.email,
      tier: user.premium_tier,
    });
    return {
      user: this.publicUser(user),
      access_token: access.token,
      refresh_token: rotated.token,
      token_type: 'Bearer',
      expires_in: access.expiresIn,
    };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.refresh.revokePresented(refreshToken);
  }

  async beginPasswordReset(input: { email: string; ip?: string }): Promise<void> {
    // Always perform the same amount of work to defeat email enumeration.
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });

    if (!user || user.delete_status !== 'active') {
      // Burn ~argon2id-equivalent cycles so timing is roughly constant.
      await this.hasher.verify(null, 'enumeration-shield');
      this.log.debug(`reset requested for unknown email (no-op)`);
      return;
    }

    const token = randomBytes(32).toString('base64url');
    const tokenHash = sha256(token);
    await this.prisma.passwordResetToken.create({
      data: {
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: new Date(Date.now() + 60 * 60 * 1000), // 1h
        ip: input.ip,
      },
    });
    await this.email.sendPasswordReset({
      to: user.email,
      token,
      locale: user.locale,
    });
  }

  async completePasswordReset(input: { token: string; newPassword: string }): Promise<void> {
    const tokenHash = sha256(input.token);
    const row = await this.prisma.passwordResetToken.findUnique({
      where: { token_hash: tokenHash },
    });
    if (!row || row.used_at || row.expires_at.getTime() < Date.now()) {
      throw new UnauthorizedException({ code: 'reset_token_invalid' });
    }
    const hash = await this.hasher.hash(input.newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: row.user_id },
        data: { password_hash: hash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: row.id },
        data: { used_at: new Date() },
      }),
    ]);
    await this.refresh.revokeAllForUser(row.user_id);
  }

  async verifyEmail(token: string): Promise<void> {
    const tokenHash = sha256(token);
    const row = await this.prisma.emailVerificationToken.findUnique({
      where: { token_hash: tokenHash },
    });
    if (!row || row.used_at || row.expires_at.getTime() < Date.now()) {
      throw new UnauthorizedException({ code: 'verify_token_invalid' });
    }
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: row.user_id }, data: { email_verified: true } }),
      this.prisma.emailVerificationToken.update({
        where: { id: row.id },
        data: { used_at: new Date() },
      }),
    ]);
  }

  async issueTokens(
    user: {
      id: string;
      email: string;
      name: string;
      locale: Locale;
      premium_tier: 'free' | 'premium';
      email_verified: boolean;
    },
    ctx: { userAgent?: string; ip?: string },
  ): Promise<AuthResult> {
    const access = await this.jwt.signAccessToken({
      userId: user.id,
      email: user.email,
      tier: user.premium_tier,
    });
    const refresh = await this.refresh.issue({
      userId: user.id,
      userAgent: ctx.userAgent ?? null,
      ip: ctx.ip ?? null,
    });
    return {
      user: this.publicUser(user),
      access_token: access.token,
      refresh_token: refresh.token,
      token_type: 'Bearer',
      expires_in: access.expiresIn,
    };
  }

  private publicUser(u: {
    id: string;
    email: string;
    name: string;
    locale: Locale;
    premium_tier: 'free' | 'premium';
    email_verified: boolean;
  }): AuthResult['user'] {
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      locale: u.locale,
      premium_tier: u.premium_tier,
      email_verified: u.email_verified,
    };
  }
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}
