import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { AuthGuard, type AuthedRequest } from '../auth/auth.guard.js';
import { NotificationsService } from './notifications.service.js';
import { z } from 'zod';

const RuleSchema = z.object({
  stop_id: z.string().uuid(),
  route_id: z.string().uuid().nullable().optional(),
  threshold_minutes: z.number().int().min(1).max(60),
  days_of_week_bitmask: z.number().int().min(0).max(127).optional(),
  quiet_hours_start_min: z.number().int().min(0).max(1439).nullable().optional(),
  quiet_hours_end_min: z.number().int().min(0).max(1439).nullable().optional(),
  enabled: z.boolean().optional(),
});
type RuleDto = z.infer<typeof RuleSchema>;

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('users/me/notification-rules')
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.svc.list(req.user!.sub);
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body(new ZodValidationPipe(RuleSchema)) body: RuleDto) {
    return this.svc.create(req.user!.sub, body);
  }

  @Patch(':id')
  update(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RuleSchema.partial())) body: Partial<RuleDto>,
  ) {
    return this.svc.update(req.user!.sub, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    await this.svc.remove(req.user!.sub, id);
  }

  @Get('log')
  log(@Req() req: AuthedRequest) {
    return this.svc.recentLog(req.user!.sub);
  }
}
