import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    CORS_ORIGINS: z.string().default('*'),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url().optional(),
    SENTRY_DSN: z.string().url().optional(),
    SENTRY_ENVIRONMENT: z.string().default('development'),
    SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),

    // ── JWT ────────────────────────────────────────────────────────────────
    // Pluggable key loader. Pick exactly one mode in prod.
    //   • inline:   JWT_PRIVATE_KEY_PEM + JWT_PUBLIC_KEY_PEM (multiline PEMs)
    //   • file:     JWT_PRIVATE_KEY_FILE + JWT_PUBLIC_KEY_FILE (paths)
    //   • secret:   JWT_KEY_SECRET_ARN (Secrets Manager) — implementation in src/modules/jwt/loaders/secrets-manager.ts
    //   • generate: dev only — keys are generated in-memory at boot (NOT persisted across restarts)
    JWT_KEY_SOURCE: z.enum(['inline', 'file', 'secret', 'generate']).default('generate'),
    JWT_PRIVATE_KEY_PEM: z.string().optional(),
    JWT_PUBLIC_KEY_PEM: z.string().optional(),
    JWT_PRIVATE_KEY_FILE: z.string().optional(),
    JWT_PUBLIC_KEY_FILE: z.string().optional(),
    JWT_KEY_SECRET_ARN: z.string().optional(),
    JWT_ISSUER: z.string().default('app-bus'),
    JWT_AUDIENCE: z.string().default('app-bus.tr'),
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900), // 15 min
    JWT_REFRESH_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(60 * 60 * 24 * 30), // 30 days

    // ── KVKK ───────────────────────────────────────────────────────────────
    KVKK_CURRENT_VERSION: z.string().default('2026-05-05'),

    // ── Email / SMS ────────────────────────────────────────────────────────
    // Adapters: 'dev' = log only; 'ses' / 'iletimerkezi' = real wire.
    EMAIL_ADAPTER: z.enum(['dev', 'ses']).default('dev'),
    SES_REGION: z.string().default('eu-central-1'),
    EMAIL_FROM: z.string().email().default('no-reply@app-bus.tr'),

    SMS_ADAPTER: z.enum(['dev', 'iletimerkezi']).default('dev'),
    ILETIMERKEZI_USER: z.string().optional(),
    ILETIMERKEZI_PASSWORD: z.string().optional(),
    ILETIMERKEZI_SENDER: z.string().default('APPBUS'),

    // ── OAuth ──────────────────────────────────────────────────────────────
    OAUTH_GOOGLE_CLIENT_IDS: z.string().default(''), // comma-separated audience list
    OAUTH_APPLE_CLIENT_IDS: z.string().default(''),

    // ── Public URLs (used in emails, deep links) ───────────────────────────
    PUBLIC_API_URL: z.string().url().default('http://localhost:3000'),
    PUBLIC_WEB_URL: z.string().url().default('http://localhost:3000'),
    APP_DEEP_LINK_SCHEME: z.string().default('appbus-dev'),

    // ── Transit static data sources (Phase 2) ──────────────────────────────
    GTFS_IETT_URL: z.string().url().optional(),
    GTFS_EGO_URL: z.string().url().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.JWT_KEY_SOURCE === 'generate') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_KEY_SOURCE'],
        message: "JWT_KEY_SOURCE='generate' is forbidden in production",
      });
    }
    if (env.JWT_KEY_SOURCE === 'inline' && (!env.JWT_PRIVATE_KEY_PEM || !env.JWT_PUBLIC_KEY_PEM)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_KEY_SOURCE'],
        message: "JWT_KEY_SOURCE='inline' requires JWT_PRIVATE_KEY_PEM and JWT_PUBLIC_KEY_PEM",
      });
    }
    if (env.JWT_KEY_SOURCE === 'file' && (!env.JWT_PRIVATE_KEY_FILE || !env.JWT_PUBLIC_KEY_FILE)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_KEY_SOURCE'],
        message: "JWT_KEY_SOURCE='file' requires JWT_PRIVATE_KEY_FILE and JWT_PUBLIC_KEY_FILE",
      });
    }
    if (env.JWT_KEY_SOURCE === 'secret' && !env.JWT_KEY_SECRET_ARN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_KEY_SOURCE'],
        message: "JWT_KEY_SOURCE='secret' requires JWT_KEY_SECRET_ARN",
      });
    }
    if (env.EMAIL_ADAPTER === 'ses' && env.NODE_ENV === 'production' && !env.SES_REGION) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SES_REGION'],
        message: "SES_REGION required when EMAIL_ADAPTER='ses'",
      });
    }
    if (
      env.SMS_ADAPTER === 'iletimerkezi' &&
      (!env.ILETIMERKEZI_USER || !env.ILETIMERKEZI_PASSWORD)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SMS_ADAPTER'],
        message: 'İletimerkezi adapter requires ILETIMERKEZI_USER + ILETIMERKEZI_PASSWORD',
      });
    }
  });

export type AppEnv = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): AppEnv {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return parsed.data;
}
