import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from '../../../common/zod-validation.pipe.js';
import { TransitQueryService } from '../transit-query.service.js';
import { Public } from '../../auth/auth.guard.js';
import { z } from 'zod';

const NearbySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius_m: z.coerce.number().int().positive().max(5000).default(500),
  limit: z.coerce.number().int().positive().max(200).default(50),
});
type NearbyDto = z.infer<typeof NearbySchema>;

@ApiTags('transit')
@Controller('stops')
export class StopsController {
  constructor(private readonly q: TransitQueryService) {}

  @Get('nearby')
  @Public()
  nearby(@Query(new ZodValidationPipe(NearbySchema)) q: NearbyDto) {
    return this.q.stopsNearby({
      lat: q.lat,
      lng: q.lng,
      radiusM: q.radius_m,
      limit: q.limit,
    });
  }

  @Get(':id')
  @Public()
  async get(@Param('id') id: string) {
    const stop = await this.q.getStop(id);
    if (!stop) throw new NotFoundException({ code: 'stop_not_found' });
    return stop;
  }
}
