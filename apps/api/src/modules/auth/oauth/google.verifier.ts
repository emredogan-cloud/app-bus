import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnv } from '../../../config/env.js';
import { JwksClient } from './jwks-client.js';
import { verifyOidcIdToken, type OidcClaims } from './oauth-claims.js';

const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const GOOGLE_JWKS = 'https://www.googleapis.com/oauth2/v3/certs';

@Injectable()
export class GoogleVerifier {
  constructor(
    private readonly config: ConfigService<AppEnv, true>,
    private readonly jwks: JwksClient,
  ) {}

  async verify(idToken: string): Promise<OidcClaims> {
    const audCsv = this.config.get('OAUTH_GOOGLE_CLIENT_IDS', { infer: true });
    const audiences = audCsv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (audiences.length === 0) {
      throw new UnauthorizedException({ code: 'oauth_google_unconfigured' });
    }

    try {
      return await verifyOidcIdToken(idToken, {
        expectedIssuer: GOOGLE_ISSUERS,
        expectedAudiences: audiences,
        jwksKey: (kid) => this.jwks.getKey(GOOGLE_JWKS, kid),
      });
    } catch (err) {
      throw new UnauthorizedException({
        code: 'oauth_google_invalid',
        detail: (err as Error).message,
      });
    }
  }
}
