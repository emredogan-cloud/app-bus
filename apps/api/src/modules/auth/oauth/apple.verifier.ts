import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnv } from '../../../config/env.js';
import { JwksClient } from './jwks-client.js';
import { verifyOidcIdToken, type OidcClaims } from './oauth-claims.js';

const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_JWKS = 'https://appleid.apple.com/auth/keys';

@Injectable()
export class AppleVerifier {
  constructor(
    private readonly config: ConfigService<AppEnv, true>,
    private readonly jwks: JwksClient,
  ) {}

  async verify(idToken: string): Promise<OidcClaims> {
    const audCsv = this.config.get('OAUTH_APPLE_CLIENT_IDS', { infer: true });
    const audiences = audCsv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (audiences.length === 0) {
      throw new UnauthorizedException({ code: 'oauth_apple_unconfigured' });
    }

    try {
      return await verifyOidcIdToken(idToken, {
        expectedIssuer: APPLE_ISSUER,
        expectedAudiences: audiences,
        jwksKey: (kid) => this.jwks.getKey(APPLE_JWKS, kid),
      });
    } catch (err) {
      throw new UnauthorizedException({
        code: 'oauth_apple_invalid',
        detail: (err as Error).message,
      });
    }
  }
}
