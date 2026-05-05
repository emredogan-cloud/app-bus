import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSign, createVerify, KeyObject } from 'node:crypto';
import type { AppEnv } from '../../config/env.js';
import { KeyLoader } from './key-loader.js';

export interface AccessTokenClaims {
  sub: string; // user id
  email: string;
  tier: 'free' | 'premium';
  // standard
  iss: string;
  aud: string;
  iat: number;
  exp: number;
  jti: string;
}

export class TokenError extends Error {
  constructor(
    public readonly code:
      | 'malformed'
      | 'bad_signature'
      | 'expired'
      | 'wrong_issuer'
      | 'wrong_audience'
      | 'unsupported_alg'
      | 'unsupported_kid',
    message: string,
  ) {
    super(message);
    this.name = 'TokenError';
  }
}

interface JwsHeader {
  alg: 'RS256';
  typ: 'JWT';
  kid?: string;
}

@Injectable()
export class JwtService {
  constructor(
    private readonly config: ConfigService<AppEnv, true>,
    private readonly keys: KeyLoader,
  ) {}

  async signAccessToken(input: {
    userId: string;
    email: string;
    tier: 'free' | 'premium';
  }): Promise<{
    token: string;
    expiresIn: number;
    jti: string;
  }> {
    const ttl = this.config.get('JWT_ACCESS_TTL_SECONDS', { infer: true });
    const issuer = this.config.get('JWT_ISSUER', { infer: true });
    const audience = this.config.get('JWT_AUDIENCE', { infer: true });
    const now = Math.floor(Date.now() / 1000);
    const jti = randomJti();

    const payload: AccessTokenClaims = {
      sub: input.userId,
      email: input.email,
      tier: input.tier,
      iss: issuer,
      aud: audience,
      iat: now,
      exp: now + ttl,
      jti,
    };

    const { privateKey, kid } = await this.keys.getKeys();
    const token = signRs256(payload, privateKey, kid);
    return { token, expiresIn: ttl, jti };
  }

  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    const { publicKey, kid: currentKid } = await this.keys.getKeys();
    const claims = verifyRs256<AccessTokenClaims>(token, publicKey, currentKid);

    const issuer = this.config.get('JWT_ISSUER', { infer: true });
    const audience = this.config.get('JWT_AUDIENCE', { infer: true });
    if (claims.iss !== issuer) throw new TokenError('wrong_issuer', `iss=${claims.iss}`);
    if (claims.aud !== audience) throw new TokenError('wrong_audience', `aud=${claims.aud}`);
    if (claims.exp < Math.floor(Date.now() / 1000))
      throw new TokenError('expired', 'access token expired');

    return claims;
  }
}

function signRs256(payload: object, privateKey: KeyObject, kid: string): string {
  const header: JwsHeader = { alg: 'RS256', typ: 'JWT', kid };
  const headerB64 = b64url(JSON.stringify(header));
  const payloadB64 = b64url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const sig = signer.sign(privateKey).toString('base64url');
  return `${signingInput}.${sig}`;
}

function verifyRs256<T>(token: string, publicKey: KeyObject, expectedKid: string): T {
  const parts = token.split('.');
  if (parts.length !== 3) throw new TokenError('malformed', 'expected 3 dot-separated parts');
  const [headerB64, payloadB64, sigB64] = parts;

  let header: JwsHeader;
  try {
    header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8')) as JwsHeader;
  } catch {
    throw new TokenError('malformed', 'header not JSON');
  }
  if (header.alg !== 'RS256') throw new TokenError('unsupported_alg', `alg=${header.alg}`);
  if (header.kid && header.kid !== expectedKid) {
    // Reject tokens minted under a previous key to defeat "old key still works" pitfalls.
    throw new TokenError('unsupported_kid', `kid=${header.kid}`);
  }

  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();
  const ok = verifier.verify(publicKey, Buffer.from(sigB64, 'base64url'));
  if (!ok) throw new TokenError('bad_signature', 'signature mismatch');

  try {
    return JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as T;
  } catch {
    throw new TokenError('malformed', 'payload not JSON');
  }
}

function b64url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function randomJti(): string {
  // 22 chars base64url ≈ 132 bits — plenty of entropy.
  return Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64url');
}
