import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller.js';
import { HealthCheckService, TerminusModule } from '@nestjs/terminus';
import { PrismaHealthIndicator } from './prisma.health.js';

describe('HealthController (liveness)', () => {
  let controller: HealthController;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TerminusModule],
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaHealthIndicator,
          useValue: { isHealthy: jest.fn().mockResolvedValue({ database: { status: 'up' } }) },
        },
      ],
    }).compile();

    controller = moduleRef.get(HealthController);
    moduleRef.get(HealthCheckService);
  });

  it('returns ok with service name and uptime', () => {
    const result = controller.liveness();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('api');
    expect(typeof result.uptime_s).toBe('number');
    expect(result.uptime_s).toBeGreaterThanOrEqual(0);
  });
});
