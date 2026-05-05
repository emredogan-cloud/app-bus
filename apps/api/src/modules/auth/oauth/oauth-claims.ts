import { createVerify, KeyObject } from 'node:crypto';

export interface OidcClaims {
  iss: string;
  sub: string;
  aud: string | string[];
  iat: number;
  exp: number;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  locale?: string;
  // Apple-specific:
  is_private_email?: boolean;
}

export interface VerifyOidcOptions {
  expectedIssuer: string | string[];
  expectedAudiences: string[]; // any one match → ok
  jwksKey: (kid: string, alg: string) => Promise<KeyObject>;
  /** Allowed clock skew in seconds. */
  leewaySec?: number;
}

interface JwsHeader {
  alg: string;
  kid?: string;
  typ?: string;
}

/**
 * Verify an OIDC ID token (RS256) against the supplied JWKS resolver and audience list.
 *
 * Throws on any failure. Callers should map to UnauthorizedException.
 */
export async function verifyOidcIdToken(
  token: string,
  opts: VerifyOidcOptions,
): Promise<OidcClaims> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('id_token_malformed');
  const [hB64, pB64, sB64] = parts;
  const header = JSON.parse(Buffer.from(hB64, 'base64url').toString('utf8')) as JwsHeader;

  if (header.alg !== 'RS256') throw new Error(`id_token_unsupported_alg:${header.alg}`);
  if (!header.kid) throw new Error('id_token_missing_kid');

  const key = await opts.jwksKey(header.kid, header.alg);
  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${hB64}.${pB64}`);
  verifier.end();
  const ok = verifier.verify(key, Buffer.from(sB64, 'base64url'));
  if (!ok) throw new Error('id_token_bad_signature');

  const claims = JSON.parse(Buffer.from(pB64, 'base64url').toString('utf8')) as OidcClaims;

  const expectedIssuers = Array.isArray(opts.expectedIssuer)
    ? opts.expectedIssuer
    : [opts.expectedIssuer];
  if (!expectedIssuers.includes(claims.iss)) {
    throw new Error(`id_token_wrong_issuer:${claims.iss}`);
  }

  const audSet = new Set(Array.isArray(claims.aud) ? claims.aud : [claims.aud]);
  if (!opts.expectedAudiences.some((a) => audSet.has(a))) {
    throw new Error('id_token_wrong_audience');
  }

  const now = Math.floor(Date.now() / 1000);
  const leeway = opts.leewaySec ?? 60;
  if (claims.exp + leeway < now) throw new Error('id_token_expired');
  if (claims.iat - leeway > now) throw new Error('id_token_not_yet_valid');

  return claims;
}
