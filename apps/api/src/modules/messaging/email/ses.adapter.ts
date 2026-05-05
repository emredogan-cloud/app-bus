import { Logger } from '@nestjs/common';
import type { EmailAdapter, EmailMessage } from '../email.service.js';

/**
 * AWS SES adapter. Phase 1 stub — wire up @aws-sdk/client-sesv2 in the
 * deployment phase (Phase 7) when SES sandbox is opened up.
 *
 * Until then the adapter validates input and throws a clear error so that
 * EMAIL_ADAPTER='ses' in dev fails loudly instead of silently dropping mail.
 */
export class SesEmailAdapter implements EmailAdapter {
  private readonly log = new Logger(SesEmailAdapter.name);

  constructor(private readonly opts: { region: string; from: string }) {}

  async send(_msg: EmailMessage): Promise<void> {
    this.log.error(
      `SES adapter not yet wired (region=${this.opts.region} from=${this.opts.from}). ` +
        'Set EMAIL_ADAPTER=dev until Phase 7 deployment work lands.',
    );
    throw new Error('ses_adapter_not_implemented');
  }
}
