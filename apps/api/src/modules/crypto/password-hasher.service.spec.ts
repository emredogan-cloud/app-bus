import { PasswordHasher } from './password-hasher.service.js';

describe('PasswordHasher', () => {
  const hasher = new PasswordHasher();

  it('produces a verifiable argon2id hash', async () => {
    const hash = await hasher.hash('correct horse battery staple');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    await expect(hasher.verify(hash, 'correct horse battery staple')).resolves.toBe(true);
  });

  it('rejects wrong password', async () => {
    const hash = await hasher.hash('Tr0ub4dor&3');
    await expect(hasher.verify(hash, 'wrong')).resolves.toBe(false);
  });

  it('returns false (not throws) on null hash, but still does work to mask timing', async () => {
    const start = Date.now();
    await expect(hasher.verify(null, 'anything')).resolves.toBe(false);
    // Crude lower bound: argon2id with our params should take more than 5ms.
    // (Don't assert an upper bound — CI variance is too high.)
    expect(Date.now() - start).toBeGreaterThan(5);
  });

  it('needsRehash returns false for a fresh hash', async () => {
    const hash = await hasher.hash('whatever');
    expect(hasher.needsRehash(hash)).toBe(false);
  });
});
