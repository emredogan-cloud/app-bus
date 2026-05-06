import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller.js';
import { DevicesController } from './devices.controller.js';
import { NotificationsService } from './notifications.service.js';
import { DevicesService } from './devices.service.js';
import { NotificationEvaluator } from './notification-evaluator.js';
import { ExpoPushAdapter } from './expo-push.adapter.js';
import { RuleMatcher } from './rule-matcher.js';
import { EtaModule } from '../eta/eta.module.js';

@Module({
  imports: [EtaModule],
  controllers: [NotificationsController, DevicesController],
  providers: [
    NotificationsService,
    DevicesService,
    NotificationEvaluator,
    ExpoPushAdapter,
    RuleMatcher,
  ],
  exports: [NotificationsService, DevicesService],
})
export class NotificationsModule {}
