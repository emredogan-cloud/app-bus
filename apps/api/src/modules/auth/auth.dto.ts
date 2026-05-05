import { z } from 'zod';
import { LocaleSchema } from '@app-bus/types';

const PasswordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128)
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a digit');

export const RegisterDtoSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: PasswordSchema,
  name: z.string().min(1).max(120),
  locale: LocaleSchema.default('tr'),
  kvkk_consent_version: z.string(),
  marketing_opt_in: z.boolean().default(false),
});
export type RegisterDto = z.infer<typeof RegisterDtoSchema>;

export const LoginDtoSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});
export type LoginDto = z.infer<typeof LoginDtoSchema>;

export const RefreshDtoSchema = z.object({
  refresh_token: z.string().min(1),
});
export type RefreshDto = z.infer<typeof RefreshDtoSchema>;

export const ForgotPasswordDtoSchema = z.object({
  email: z.string().email().toLowerCase(),
});
export type ForgotPasswordDto = z.infer<typeof ForgotPasswordDtoSchema>;

export const ResetPasswordDtoSchema = z.object({
  token: z.string().min(1),
  new_password: PasswordSchema,
});
export type ResetPasswordDto = z.infer<typeof ResetPasswordDtoSchema>;

export const OAuthDtoSchema = z.object({
  id_token: z.string().min(1),
  kvkk_consent_version: z.string().optional(),
  marketing_opt_in: z.boolean().optional(),
});
export type OAuthDto = z.infer<typeof OAuthDtoSchema>;
