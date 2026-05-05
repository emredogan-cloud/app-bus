import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { UsersService } from './users.service.js';
import { UsersController } from './users.controller.js';
import { AccountPurgeJob } from './account-purge.job.js';
import { RefreshTokenService } from '../auth/refresh-token.service.js';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [UsersController],
  providers: [UsersService, AccountPurgeJob, RefreshTokenService],
  exports: [UsersService],
})
export class UsersModule {}
