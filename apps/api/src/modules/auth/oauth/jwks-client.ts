import { Injectable, Logger } from '@nestjs/common';
import { createPublicKey, KeyObject } from 'node:crypto';

interface CachedJwks {
  fetchedAt: number;
  ttlMs: number;
  keys: Map<string, KeyObject>;
}

interface JwkRsa {
  kty: 'RSA';
  kid: string;
  alg?: string;
  use?: string;
  n: string;
  e: string;
}

/**
 * Minimal, low-dependency JWKS fetcher for verifying OAuth ID tokens.
 * Caches by issuer URL with a 1-hour TTL, refreshes on `kid` miss before failing.
 */
@Injectable()
export class JwksClient {
  private readonly log = new Logger(JwksClient.name);
  private readonly cache = new Map<string, CachedJwks>();

  async getKey(jwksUrl: string, kid: string): Promise<KeyObject> {
    let cached = this.cache.get(jwksUrl);
    if (!cached || Date.now() - cached.fetchedAt > cached.ttlMs) {
      cached = await this.refresh(jwksUrl);
    }
    let key = cached.keys.get(kid);
    if (!key) {
      cached = await this.refresh(jwksUrl);
      key = cached.keys.get(kid);
    }
    if (!key) throw new Error(`unknown JWKS kid: ${kid}`);
    return key;
  }

  private async refresh(url: string): Promise<CachedJwks> {
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status} ${url}`);
    const body = (await res.json()) as { keys: JwkRsa[] };
    const keys = new Map<string, KeyObject>();
    for (const jwk of body.keys ?? []) {
      if (jwk.kty !== 'RSA') continue;
      keys.set(
        jwk.kid,
        createPublicKey({
          key: jwk as unknown as import('node:crypto').JsonWebKey,
          format: 'jwk',
        }),
      );
    }
    const cached: CachedJwks = { fetchedAt: Date.now(), ttlMs: 60 * 60 * 1000, keys };
    this.cache.set(url, cached);
    this.log.debug(`refreshed JWKS for ${url} (${keys.size} keys)`);
    return cached;
  }
}
