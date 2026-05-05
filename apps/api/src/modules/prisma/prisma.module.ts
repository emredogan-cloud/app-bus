import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
import { PrismaHealthIndicator } from '../health/prisma.health.js';

@Global()
@Module({
  providers: [PrismaService, PrismaHealthIndicator],
  exports: [PrismaService, PrismaHealthIndicator],
})
export class PrismaModule {}
