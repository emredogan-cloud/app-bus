import { Test } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtService, TokenError } from './jwt.service.js';
import { KeyLoader } from './key-loader.js';

describe('JwtService', () => {
  let svc: JwtService;
  let keys: KeyLoader;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_KEY_SOURCE = 'generate';
    process.env.JWT_ISSUER = 'test-iss';
    process.env.JWT_AUDIENCE = 'test-aud';
    process.env.JWT_ACCESS_TTL_SECONDS = '900';
    process.env.JWT_REFRESH_TTL_SECONDS = '60';

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ ignoreEnvFile: true, isGlobal: true })],
      providers: [KeyLoader, JwtService],
    }).compile();

    keys = moduleRef.get(KeyLoader);
    await keys.onModuleInit();
    svc = moduleRef.get(JwtService);

    // Make ConfigService.get return env vars directly (no validation in unit test).
    const cs = moduleRef.get(ConfigService);
    jest.spyOn(cs, 'get').mockImplementation((key: string) => process.env[key as string]);
  });

  it('signs and verifies an access token', async () => {
    const { token } = await svc.signAccessToken({ userId: 'u1', email: 'a@b', tier: 'free' });
    const claims = await svc.verifyAccessToken(token);
    expect(claims.sub).toBe('u1');
    expect(claims.email).toBe('a@b');
    expect(claims.tier).toBe('free');
    expect(claims.iss).toBe('test-iss');
    expect(claims.aud).toBe('test-aud');
  });

  it('rejects a tampered payload', async () => {
    const { token } = await svc.signAccessToken({ userId: 'u1', email: 'a@b', tier: 'free' });
    const [h, p, s] = token.split('.');
    const tampered = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
    tampered.tier = 'premium';
    const newPayload = Buffer.from(JSON.stringify(tampered), 'utf8').toString('base64url');
    const bad = `${h}.${newPayload}.${s}`;
    await expect(svc.verifyAccessToken(bad)).rejects.toBeInstanceOf(TokenError);
  });

  it('rejects malformed token', async () => {
    await expect(svc.verifyAccessToken('not-a-jwt')).rejects.toBeInstanceOf(TokenError);
  });

  it('rejects token with wrong audience', async () => {
    const { token } = await svc.signAccessToken({ userId: 'u1', email: 'a@b', tier: 'free' });
    process.env.JWT_AUDIENCE = 'different-aud';
    await expect(svc.verifyAccessToken(token)).rejects.toMatchObject({ code: 'wrong_audience' });
    process.env.JWT_AUDIENCE = 'test-aud';
  });
});
