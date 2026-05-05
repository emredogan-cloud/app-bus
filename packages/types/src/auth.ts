import { z } from 'zod';
import { LocaleSchema } from './common.js';

const PasswordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128)
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a digit');

export const RegisterRequestSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: PasswordSchema,
  name: z.string().min(1).max(100),
  locale: LocaleSchema.default('tr'),
  kvkk_consent_version: z.string(),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const TokenPairSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  token_type: z.literal('Bearer'),
  expires_in: z.number().int().positive(),
});
export type TokenPair = z.infer<typeof TokenPairSchema>;

export const RefreshRequestSchema = z.object({
  refresh_token: z.string(),
});
export type RefreshRequest = z.infer<typeof RefreshRequestSchema>;

export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  locale: LocaleSchema,
  premium_tier: z.enum(['free', 'premium']),
  created_at: z.string().datetime(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;
