import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { AuthGuard, type AuthedRequest } from '../auth/auth.guard.js';
import { UsersService } from './users.service.js';
import { UpdateProfileDto, UpdateProfileDtoSchema } from './users.dto.js';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('users/me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  me(@Req() req: AuthedRequest) {
    return this.users.getMe(req.user!.sub);
  }

  @Patch()
  update(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(UpdateProfileDtoSchema)) body: UpdateProfileDto,
  ) {
    return this.users.updateMe(req.user!.sub, body);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() req: AuthedRequest) {
    await this.users.deleteMe(req.user!.sub);
  }

  @Get('export')
  exportData(@Req() req: AuthedRequest) {
    return this.users.exportData(req.user!.sub);
  }
}
