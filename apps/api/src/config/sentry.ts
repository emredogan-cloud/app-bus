import * as Sentry from '@sentry/node';

let initialized = false;

export function initSentry(): void {
  if (initialized) return;

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
    release: process.env.SENTRY_RELEASE,
    sendDefaultPii: false,
  });

  initialized = true;
}
