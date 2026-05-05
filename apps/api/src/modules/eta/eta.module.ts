import { Module } from '@nestjs/common';
import { EtaController } from './eta.controller.js';
import { EtaService } from './eta.service.js';
import { EtaCalculator } from './eta.calculator.js';
import { EtaWorker } from './eta.worker.js';
import { ScheduleFallback } from './schedule-fallback.js';

@Module({
  controllers: [EtaController],
  providers: [EtaCalculator, EtaWorker, EtaService, ScheduleFallback],
  exports: [EtaService],
})
export class EtaModule {}
