import { Controller, Get, Header, NotFoundException, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TransitQueryService } from '../transit-query.service.js';
import { Public } from '../../auth/auth.guard.js';

@ApiTags('transit')
@Controller('routes')
export class RoutesController {
  constructor(private readonly q: TransitQueryService) {}

  @Get(':id')
  @Public()
  // Route shapes are static; CDN can cache for 1h, revalidate at edge.
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600')
  async get(@Param('id') id: string) {
    const route = await this.q.getRoute(id);
    if (!route) throw new NotFoundException({ code: 'route_not_found' });
    return route;
  }
}
