import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * argon2id wrapper, tuned for ~250ms on prod hardware (per Phase 1 spec).
 *
 * Parameters:
 *   memoryCost (m) — 64 MiB (65536)
 *   parallelism (p) — 4
 *   timeCost (t) — 3
 *
 * The hash string includes the parameters so we can roll forward later without
 * a flag day; verify() reads them out of the encoded hash.
 */
@Injectable()
export class PasswordHasher {
  private readonly options: argon2.Options = {
    type: argon2.argon2id,
    memoryCost: 64 * 1024,
    parallelism: 4,
    timeCost: 3,
  };

  hash(plaintext: string): Promise<string> {
    return argon2.hash(plaintext, this.options);
  }

  /**
   * Constant-time verify. Always runs argon2 even on missing hash to keep
   * timing characteristics uniform across "user exists" / "user does not exist"
   * branches in callers.
   */
  async verify(hashOrNull: string | null | undefined, plaintext: string): Promise<boolean> {
    if (!hashOrNull) {
      // Run argon2 against a dummy hash so the timing approximates the real
      // verify path. The result is discarded; we always return false.
      try {
        await argon2.verify(DUMMY_HASH, plaintext);
      } catch {
        // ignore
      }
      return false;
    }
    try {
      return await argon2.verify(hashOrNull, plaintext);
    } catch {
      return false;
    }
  }

  /**
   * Returns true if the stored hash was produced with weaker parameters than
   * the current options — caller should re-hash on next successful login.
   */
  needsRehash(hash: string): boolean {
    return argon2.needsRehash(hash, this.options);
  }
}

// Pre-generated dummy hash (argon2id of "x"). Not a secret — exists to stabilize
// timing of failed lookups. Generated once locally; safe to ship.
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$WkFqZjBycVZqYU14R0hzeg$Y6yYUz9NfECTL1qjHq+x6w3Gx7uA0gO1RMzTW7v7sNQ';
