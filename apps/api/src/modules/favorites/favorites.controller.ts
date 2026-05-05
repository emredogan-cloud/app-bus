import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { AuthGuard, type AuthedRequest } from '../auth/auth.guard.js';
import { FavoritesService } from './favorites.service.js';
import { z } from 'zod';

const CreateSchema = z.object({
  target_type: z.enum(['stop', 'route']),
  target_id: z.string().uuid(),
  label: z.string().max(120).optional(),
});
type CreateDto = z.infer<typeof CreateSchema>;

const ReorderSchema = z.object({ ids: z.array(z.string().uuid()).max(200) });
type ReorderDto = z.infer<typeof ReorderSchema>;

@ApiTags('favorites')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('users/me/favorites')
export class FavoritesController {
  constructor(private readonly svc: FavoritesService) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.svc.list(req.user!.sub);
  }

  @Post()
  add(@Req() req: AuthedRequest, @Body(new ZodValidationPipe(CreateSchema)) body: CreateDto) {
    return this.svc.add(req.user!.sub, body.target_type, body.target_id, body.label);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    await this.svc.remove(req.user!.sub, id);
  }

  @Put('order')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reorder(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(ReorderSchema)) body: ReorderDto,
  ) {
    await this.svc.reorder(req.user!.sub, body.ids);
  }
}
