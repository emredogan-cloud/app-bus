import { Logger } from '@nestjs/common';
import type { EmailAdapter, EmailMessage } from '../email.service.js';

export class DevEmailAdapter implements EmailAdapter {
  private readonly log = new Logger(DevEmailAdapter.name);

  constructor(private readonly opts: { from: string }) {}

  async send(msg: EmailMessage): Promise<void> {
    // Dev only: print plaintext so engineers can inspect verification links in stdout.
    // In test env we silence this to keep CI logs clean.
    if (process.env.NODE_ENV === 'test') return;
    this.log.log(`[dev-email] from=${this.opts.from} to=${msg.to} subject="${msg.subject}"`);
    this.log.log(`[dev-email] body: ${msg.text}`);
  }
}
