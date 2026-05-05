import { z } from 'zod';
import { LocaleSchema } from '@app-bus/types';

export const UpdateProfileDtoSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    locale: LocaleSchema.optional(),
    phone_e164: z
      .string()
      .regex(/^\+\d{8,15}$/, 'phone must be E.164 (e.g. +905551234567)')
      .nullable()
      .optional(),
  })
  .strict()
  .refine(
    (v) => v.name !== undefined || v.locale !== undefined || v.phone_e164 !== undefined,
    'at least one field required',
  );
export type UpdateProfileDto = z.infer<typeof UpdateProfileDtoSchema>;
