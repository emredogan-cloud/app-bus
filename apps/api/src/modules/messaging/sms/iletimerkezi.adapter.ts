import { Logger } from '@nestjs/common';
import type { SmsAdapter, SmsMessage } from '../sms.service.js';

/**
 * İletimerkezi (Turkish SMS gateway) adapter.
 * KVKK DPA must be signed before going live (per Phase 1 spec).
 *
 * Phase 1 stub: validates config + endpoint shape but does not yet hit the
 * production endpoint. The HTTP wiring is added when SMS OTP is rolled out
 * (which happens in Phase 7 alongside production cutover).
 */
export class IletimerkeziSmsAdapter implements SmsAdapter {
  private readonly log = new Logger(IletimerkeziSmsAdapter.name);

  constructor(private readonly opts: { user: string; password: string; sender: string }) {}

  async send(msg: SmsMessage): Promise<void> {
    if (!/^\+\d{8,15}$/.test(msg.to)) {
      throw new Error(`invalid E.164: ${msg.to}`);
    }
    this.log.error(
      `İletimerkezi adapter stub — message NOT sent. (to=${msg.to.slice(0, 5)}*** sender=${this.opts.sender})`,
    );
    throw new Error('iletimerkezi_adapter_not_implemented');
  }
}
