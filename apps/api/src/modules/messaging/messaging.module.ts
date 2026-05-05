import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnv } from '../../config/env.js';
import { EmailService, EMAIL_ADAPTER } from './email.service.js';
import { DevEmailAdapter } from './email/dev.adapter.js';
import { SesEmailAdapter } from './email/ses.adapter.js';
import { SmsService, SMS_ADAPTER } from './sms.service.js';
import { DevSmsAdapter } from './sms/dev.adapter.js';
import { IletimerkeziSmsAdapter } from './sms/iletimerkezi.adapter.js';

@Global()
@Module({
  providers: [
    {
      provide: EMAIL_ADAPTER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnv, true>) => {
        const adapter = config.get('EMAIL_ADAPTER', { infer: true });
        const from = config.get('EMAIL_FROM', { infer: true });
        if (adapter === 'ses') {
          return new SesEmailAdapter({ region: config.get('SES_REGION', { infer: true }), from });
        }
        return new DevEmailAdapter({ from });
      },
    },
    EmailService,
    {
      provide: SMS_ADAPTER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnv, true>) => {
        const adapter = config.get('SMS_ADAPTER', { infer: true });
        if (adapter === 'iletimerkezi') {
          return new IletimerkeziSmsAdapter({
            user: config.get('ILETIMERKEZI_USER', { infer: true })!,
            password: config.get('ILETIMERKEZI_PASSWORD', { infer: true })!,
            sender: config.get('ILETIMERKEZI_SENDER', { infer: true }),
          });
        }
        return new DevSmsAdapter();
      },
    },
    SmsService,
  ],
  exports: [EmailService, SmsService],
})
export class MessagingModule {}
