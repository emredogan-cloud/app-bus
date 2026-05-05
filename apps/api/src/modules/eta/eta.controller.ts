import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { z } from 'zod';
import { Public } from '../auth/auth.guard.js';
import { EtaService } from './eta.service.js';

const QuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).default(10),
  horizon_min: z.coerce.number().int().positive().max(360).default(60),
});
type QueryDto = z.infer<typeof QuerySchema>;

@ApiTags('eta')
@Controller('stops/:id/etas')
export class EtaController {
  constructor(private readonly etas: EtaService) {}

  @Get()
  @Public()
  // Live freshness — but allow CDN to serve a stale-while-revalidate window.
  @Header('Cache-Control', 'public, max-age=15, stale-while-revalidate=30')
  async list(@Param('id') stopId: string, @Query(new ZodValidationPipe(QuerySchema)) q: QueryDto) {
    const items = await this.etas.getForStop(stopId, q.limit, q.horizon_min);
    return { items };
  }
}
