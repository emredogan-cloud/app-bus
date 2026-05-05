import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from '../../../common/zod-validation.pipe.js';
import { TransitQueryService } from '../transit-query.service.js';
import { Public } from '../../auth/auth.guard.js';
import { z } from 'zod';
import type { CityCode } from '@prisma/client';

const SearchSchema = z.object({
  q: z.string().min(1).max(120),
  city: z.enum(['IST', 'ANK']).optional(),
  limit: z.coerce.number().int().positive().max(50).default(20),
});
type SearchDto = z.infer<typeof SearchSchema>;

@ApiTags('transit')
@Controller('search')
export class SearchController {
  constructor(private readonly q: TransitQueryService) {}

  @Get()
  @Public()
  search(@Query(new ZodValidationPipe(SearchSchema)) input: SearchDto) {
    return this.q.search({
      q: input.q,
      cityCode: input.city as CityCode | undefined,
      limit: input.limit,
    });
  }
}
