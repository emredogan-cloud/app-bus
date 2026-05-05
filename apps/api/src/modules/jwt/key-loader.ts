import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateKeyPairSync, KeyObject, createPrivateKey, createPublicKey } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { AppEnv } from '../../config/env.js';

export interface KeyPair {
  privateKey: KeyObject;
  publicKey: KeyObject;
  /** Stable ID derived from the public key — used as JWS `kid` for rotation safety. */
  kid: string;
}

@Injectable()
export class KeyLoader implements OnModuleInit {
  private readonly log = new Logger(KeyLoader.name);
  private cached: KeyPair | null = null;

  constructor(private readonly config: ConfigService<AppEnv, true>) {}

  async onModuleInit(): Promise<void> {
    await this.load();
  }

  async getKeys(): Promise<KeyPair> {
    if (!this.cached) await this.load();
    return this.cached!;
  }

  private async load(): Promise<void> {
    const source = this.config.get('JWT_KEY_SOURCE', { infer: true });

    let privateKey: KeyObject;
    let publicKey: KeyObject;

    switch (source) {
      case 'inline': {
        const priv = this.config.get('JWT_PRIVATE_KEY_PEM', { infer: true });
        const pub = this.config.get('JWT_PUBLIC_KEY_PEM', { infer: true });
        privateKey = createPrivateKey({ key: priv!, format: 'pem' });
        publicKey = createPublicKey({ key: pub!, format: 'pem' });
        break;
      }
      case 'file': {
        const privPath = this.config.get('JWT_PRIVATE_KEY_FILE', { infer: true });
        const pubPath = this.config.get('JWT_PUBLIC_KEY_FILE', { infer: true });
        const [priv, pub] = await Promise.all([
          readFile(privPath!, 'utf8'),
          readFile(pubPath!, 'utf8'),
        ]);
        privateKey = createPrivateKey({ key: priv, format: 'pem' });
        publicKey = createPublicKey({ key: pub, format: 'pem' });
        break;
      }
      case 'secret': {
        // Real impl is added when we wire AWS SDK in prod (Phase 7+).
        // For now we surface a clear error so misconfiguration fails fast.
        throw new Error(
          "JWT_KEY_SOURCE='secret' loader is not yet implemented. Use 'inline' or 'file' until Secrets Manager wiring lands.",
        );
      }
      case 'generate':
      default: {
        const env = this.config.get('NODE_ENV', { infer: true });
        if (env === 'production') {
          throw new Error("JWT_KEY_SOURCE='generate' is forbidden in production");
        }
        this.log.warn(
          'Generating ephemeral RS256 keypair (dev only). Tokens will not survive process restart.',
        );
        const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
        privateKey = pair.privateKey;
        publicKey = pair.publicKey;
        break;
      }
    }

    const pubDer = publicKey.export({ type: 'spki', format: 'der' });
    const kid = await import('node:crypto').then((c) =>
      c.createHash('sha256').update(pubDer).digest('hex').slice(0, 16),
    );

    this.cached = { privateKey, publicKey, kid };
    this.log.log(`JWT keys loaded (source=${source}, kid=${kid})`);
  }
}
