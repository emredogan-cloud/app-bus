import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { AuthGuard, type AuthedRequest } from '../auth/auth.guard.js';
import { DevicesService } from './devices.service.js';
import { z } from 'zod';

const RegisterSchema = z.object({
  expo_push_token: z.string().min(8),
  platform: z.enum(['ios', 'android', 'web']),
});
type RegisterDto = z.infer<typeof RegisterSchema>;

const UnregisterSchema = z.object({ expo_push_token: z.string().min(8) });
type UnregisterDto = z.infer<typeof UnregisterSchema>;

@ApiTags('devices')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('users/me/devices')
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Post()
  register(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(RegisterSchema)) body: RegisterDto,
  ) {
    return this.devices.upsert({
      userId: req.user!.sub,
      expoPushToken: body.expo_push_token,
      platform: body.platform,
    });
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async unregister(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(UnregisterSchema)) body: UnregisterDto,
  ) {
    await this.devices.remove(req.user!.sub, body.expo_push_token);
  }
}
