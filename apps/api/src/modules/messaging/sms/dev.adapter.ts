import { Logger } from '@nestjs/common';
import type { SmsAdapter, SmsMessage } from '../sms.service.js';

export class DevSmsAdapter implements SmsAdapter {
  private readonly log = new Logger(DevSmsAdapter.name);

  async send(msg: SmsMessage): Promise<void> {
    if (process.env.NODE_ENV === 'test') return;
    this.log.log(`[dev-sms] to=${msg.to} body="${msg.body}"`);
  }
}
