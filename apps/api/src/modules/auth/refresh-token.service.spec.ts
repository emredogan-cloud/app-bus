import { ConfigService } from '@nestjs/config';
import { RefreshTokenService } from './refresh-token.service.js';

/**
 * Unit-tests the refresh-token rotation + reuse-detection logic against an
 * in-memory fake of the relevant Prisma surface. Full integration coverage with
 * a real Postgres lives in apps/api/test/refresh-token.integration.spec.ts (Testcontainers).
 */

// Silence the deliberate "reuse detected" logger output during tests.
import { Logger } from '@nestjs/common';
beforeAll(() => {
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
});

interface RTRow {
  id: string;
  user_id: string;
  family_id: string;
  token_hash: string;
  rotated_at: Date | null;
  revoked_at: Date | null;
  expires_at: Date;
  user_agent: string | null;
  ip: string | null;
  created_at: Date;
}

class FakePrisma {
  rows = new Map<string, RTRow>();

  refreshToken = {
    create: jest.fn(
      async ({
        data,
      }: {
        data: Partial<RTRow> & {
          id: string;
          user_id: string;
          family_id: string;
          token_hash: string;
          expires_at: Date;
        };
      }) => {
        const row: RTRow = {
          rotated_at: null,
          revoked_at: null,
          user_agent: null,
          ip: null,
          ...data,
          created_at: new Date(),
        };
        this.rows.set(row.id, row);
        return row;
      },
    ),
    findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
      return this.rows.get(where.id) ?? null;
    }),
    update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<RTRow> }) => {
      const row = this.rows.get(where.id);
      if (!row) throw new Error('not found');
      Object.assign(row, data);
      return row;
    }),
    updateMany: jest.fn(
      async ({ where, data }: { where: Partial<RTRow>; data: Partial<RTRow> }) => {
        let count = 0;
        for (const r of this.rows.values()) {
          const matches =
            (where.family_id === undefined || r.family_id === where.family_id) &&
            (where.user_id === undefined || r.user_id === where.user_id) &&
            (where.id === undefined || r.id === where.id) &&
            (where.revoked_at === undefined || r.revoked_at === where.revoked_at);
          if (matches) {
            Object.assign(r, data);
            count++;
          }
        }
        return { count };
      },
    ),
  };

  $transaction = async <T>(fn: (tx: FakePrisma) => Promise<T>): Promise<T> => fn(this);
}

describe('RefreshTokenService — rotation + reuse detection', () => {
  let prisma: FakePrisma;
  let svc: RefreshTokenService;

  beforeEach(() => {
    prisma = new FakePrisma();
    const config = new ConfigService({ JWT_REFRESH_TTL_SECONDS: 60 } as Record<string, unknown>);
    svc = new RefreshTokenService(prisma as unknown as never, config as never);
  });

  it('issues a token and rotates it once, returning a new token in the same family', async () => {
    const issued = await svc.issue({ userId: 'u1' });
    expect(issued.token.split('.').length).toBe(2);

    const rotated = await svc.rotate({ presented: issued.token });
    expect(rotated.userId).toBe('u1');
    expect(rotated.familyId).toBe(issued.familyId);
    expect(rotated.token).not.toBe(issued.token);
  });

  it('reuse of an already-rotated token revokes the entire family', async () => {
    const issued = await svc.issue({ userId: 'u1' });
    const successor = await svc.rotate({ presented: issued.token });

    // Replay the original (already-rotated) token — should fail
    await expect(svc.rotate({ presented: issued.token })).rejects.toThrow('refresh_token_reuse');

    // The successor should ALSO now be revoked because reuse detection
    // invalidates the whole family.
    await expect(svc.rotate({ presented: successor.token })).rejects.toThrow('refresh_token_reuse');
  });

  it('rejects unknown token id', async () => {
    await expect(
      svc.rotate({ presented: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.x' }),
    ).rejects.toThrow('refresh_token_unknown');
  });

  it('rejects malformed token', async () => {
    await expect(svc.rotate({ presented: 'no-dot' })).rejects.toThrow('refresh_token_malformed');
  });

  it('rejects expired token', async () => {
    const issued = await svc.issue({ userId: 'u1' });
    // Force expiry on the stored row
    const id = issued.token.split('.')[0];
    const row = prisma.rows.get(id)!;
    row.expires_at = new Date(Date.now() - 1000);
    await expect(svc.rotate({ presented: issued.token })).rejects.toThrow('refresh_token_expired');
  });

  it('logout (revokePresented) blocks subsequent rotation', async () => {
    const issued = await svc.issue({ userId: 'u1' });
    await svc.revokePresented(issued.token);
    // Revoked — counts as a reuse-style theft signal.
    await expect(svc.rotate({ presented: issued.token })).rejects.toThrow('refresh_token_reuse');
  });

  it('revokeAllForUser scopes to one user', async () => {
    const a = await svc.issue({ userId: 'userA' });
    const b = await svc.issue({ userId: 'userB' });
    await svc.revokeAllForUser('userA');
    await expect(svc.rotate({ presented: a.token })).rejects.toThrow();
    await expect(svc.rotate({ presented: b.token })).resolves.toBeTruthy();
  });
});
