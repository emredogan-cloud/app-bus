import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TransitQueryService } from '../transit-query.service.js';
import { Public } from '../../auth/auth.guard.js';
import type { CityCode, TransitMode } from '@prisma/client';

@ApiTags('transit')
@Controller('cities')
export class CitiesController {
  constructor(private readonly q: TransitQueryService) {}

  @Get()
  @Public()
  list() {
    return this.q.listCities();
  }

  @Get(':code/routes')
  @Public()
  routesForCity(
    @Param('code') code: CityCode,
    @Query('mode') mode?: TransitMode,
    @Query('cursor') cursor?: string,
    @Query('limit') limitStr?: string,
  ) {
    const limit = clampLimit(limitStr);
    return this.q.listRoutes(code, mode, cursor, limit);
  }
}

function clampLimit(s: string | undefined): number {
  const n = parseInt(s ?? '50', 10);
  if (Number.isNaN(n)) return 50;
  return Math.max(1, Math.min(200, n));
}
