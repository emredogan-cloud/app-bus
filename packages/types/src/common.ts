import { z } from 'zod';

export const LocaleSchema = z.enum(['tr', 'en']);
export type Locale = z.infer<typeof LocaleSchema>;

export const CityCodeSchema = z.enum(['IST', 'ANK']);
export type CityCode = z.infer<typeof CityCodeSchema>;

export const TransitModeSchema = z.enum(['bus', 'metro', 'tram', 'ferry', 'funicular']);
export type TransitMode = z.infer<typeof TransitModeSchema>;

export const ConfidenceSchema = z.enum(['high', 'medium', 'low']);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const PaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().positive().max(100).default(20),
});
export type Pagination = z.infer<typeof PaginationSchema>;

/**
 * RFC 7807 Problem Details for HTTP APIs.
 */
export const ProblemDetailsSchema = z.object({
  type: z.string().url(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  instance: z.string().optional(),
});
export type ProblemDetails = z.infer<typeof ProblemDetailsSchema>;

export const HealthStatusSchema = z.object({
  status: z.enum(['ok', 'degraded', 'down']),
  service: z.string(),
  version: z.string(),
  uptime_s: z.number(),
  checks: z.record(z.enum(['ok', 'degraded', 'down'])).optional(),
});
export type HealthStatus = z.infer<typeof HealthStatusSchema>;
