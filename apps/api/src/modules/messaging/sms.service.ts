import { Inject, Injectable, Logger } from '@nestjs/common';

export interface SmsMessage {
  to: string; // E.164 (+90...)
  body: string;
}

export interface SmsAdapter {
  send(msg: SmsMessage): Promise<void>;
}

export const SMS_ADAPTER = Symbol('SMS_ADAPTER');

@Injectable()
export class SmsService {
  private readonly log = new Logger(SmsService.name);

  constructor(@Inject(SMS_ADAPTER) private readonly adapter: SmsAdapter) {}

  async sendOtp(input: { to: string; code: string; locale: 'tr' | 'en' }): Promise<void> {
    const body =
      input.locale === 'tr'
        ? `App-Bus dogrulama kodunuz: ${input.code}. Kodu kimseyle paylasmayin.`
        : `Your App-Bus verification code: ${input.code}. Don't share it.`;

    try {
      await this.adapter.send({ to: input.to, body });
    } catch (err) {
      this.log.error(`sms send failed: ${(err as Error).message}`);
      throw err;
    }
  }
}
