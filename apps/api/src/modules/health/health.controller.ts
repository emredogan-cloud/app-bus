import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { ApiTags } from '@nestjs/swagger';
import { PrismaHealthIndicator } from './prisma.health.js';
import { Public } from '../auth/auth.guard.js';

@ApiTags('health')
@Controller()
@Public()
export class HealthController {
  private readonly startedAt = Date.now();

  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaHealthIndicator,
  ) {}

  @Get('health')
  liveness(): { status: 'ok'; service: 'api'; uptime_s: number } {
    return {
      status: 'ok',
      service: 'api',
      uptime_s: Math.floor((Date.now() - this.startedAt) / 1000),
    };
  }

  @Get('healthz')
  @HealthCheck()
  readinessAlias() {
    return this.readiness();
  }

  @Get('readyz')
  @HealthCheck()
  readiness() {
    return this.health.check([() => this.prisma.isHealthy('database')]);
  }
}
