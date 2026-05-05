import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnv } from '../../config/env.js';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailAdapter {
  send(msg: EmailMessage): Promise<void>;
}

export const EMAIL_ADAPTER = Symbol('EMAIL_ADAPTER');

@Injectable()
export class EmailService {
  private readonly log = new Logger(EmailService.name);

  constructor(
    @Inject(EMAIL_ADAPTER) private readonly adapter: EmailAdapter,
    private readonly config: ConfigService<AppEnv, true>,
  ) {}

  async sendVerification(input: { to: string; token: string; locale: 'tr' | 'en' }): Promise<void> {
    const url = `${this.config.get('PUBLIC_API_URL', { infer: true })}/v1/auth/verify-email?token=${encodeURIComponent(input.token)}`;
    const tpl = templates.verification[input.locale];
    await this.send({
      to: input.to,
      subject: tpl.subject,
      html: tpl.html(url),
      text: tpl.text(url),
    });
  }

  async sendPasswordReset(input: {
    to: string;
    token: string;
    locale: 'tr' | 'en';
  }): Promise<void> {
    const scheme = this.config.get('APP_DEEP_LINK_SCHEME', { infer: true });
    const url = `${scheme}://reset-password?token=${encodeURIComponent(input.token)}`;
    const tpl = templates.reset[input.locale];
    await this.send({
      to: input.to,
      subject: tpl.subject,
      html: tpl.html(url),
      text: tpl.text(url),
    });
  }

  private async send(msg: EmailMessage): Promise<void> {
    try {
      await this.adapter.send(msg);
    } catch (err) {
      // Surface the error type but redact recipient + body so logs aren't a PII honeypot.
      this.log.error(`email send failed: ${(err as Error).message}`);
      throw err;
    }
  }
}

// Localized email templates. Kept inline for Phase 1; will move to apps/api/templates/ in Phase 7.
const templates = {
  verification: {
    tr: {
      subject: 'E-posta adresinizi doğrulayın',
      html: (url: string) =>
        `<p>App-Bus hesabınızı doğrulamak için aşağıdaki bağlantıya tıklayın:</p><p><a href="${url}">${url}</a></p><p>Bağlantı 24 saat içinde geçerliliğini yitirir.</p>`,
      text: (url: string) =>
        `App-Bus hesabınızı doğrulamak için: ${url}\n(Bağlantı 24 saat geçerlidir.)`,
    },
    en: {
      subject: 'Verify your email',
      html: (url: string) =>
        `<p>Click below to verify your App-Bus account:</p><p><a href="${url}">${url}</a></p><p>The link expires in 24 hours.</p>`,
      text: (url: string) => `Verify your App-Bus account: ${url}\n(Expires in 24 hours.)`,
    },
  },
  reset: {
    tr: {
      subject: 'Şifre sıfırlama isteği',
      html: (url: string) =>
        `<p>Şifrenizi sıfırlamak için uygulamayı açın: <a href="${url}">${url}</a></p><p>İstek size ait değilse bu mesajı yok sayın.</p>`,
      text: (url: string) =>
        `Şifrenizi sıfırlamak için: ${url}\n(İstek size ait değilse yok sayın.)`,
    },
    en: {
      subject: 'Password reset',
      html: (url: string) =>
        `<p>Open the app to reset your password: <a href="${url}">${url}</a></p><p>Ignore this email if you didn't request it.</p>`,
      text: (url: string) =>
        `Reset your password: ${url}\n(Ignore this email if you didn't request it.)`,
    },
  },
};
