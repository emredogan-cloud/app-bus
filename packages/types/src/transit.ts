import { z } from 'zod';
import { CityCodeSchema, ConfidenceSchema, TransitModeSchema } from './common.js';

export const LatLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type LatLng = z.infer<typeof LatLngSchema>;

export const BBoxSchema = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);
export type BBox = z.infer<typeof BBoxSchema>;

export const StopSchema = z.object({
  id: z.string().uuid(),
  external_id: z.string(),
  name_tr: z.string(),
  name_en: z.string().nullable(),
  location: LatLngSchema,
  modes: z.array(TransitModeSchema),
  city: CityCodeSchema,
});
export type Stop = z.infer<typeof StopSchema>;

export const RouteSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name_tr: z.string(),
  name_en: z.string().nullable(),
  mode: TransitModeSchema,
  city: CityCodeSchema,
  active: z.boolean(),
});
export type Route = z.infer<typeof RouteSchema>;

export const VehiclePositionSchema = z.object({
  vehicle_id: z.string(),
  route_id: z.string().uuid(),
  lat: z.number(),
  lng: z.number(),
  speed_kmh: z.number().nonnegative(),
  heading: z.number().min(0).max(360),
  recorded_at: z.string().datetime(),
  source_lag_ms: z.number().int().nonnegative(),
});
export type VehiclePosition = z.infer<typeof VehiclePositionSchema>;

export const EtaSchema = z.object({
  route_id: z.string().uuid(),
  route_code: z.string(),
  headsign: z.string(),
  eta_unix: z.number().int(),
  eta_seconds: z.number().int().nonnegative(),
  confidence: ConfidenceSchema,
  vehicle_id: z.string().optional(),
  distance_m: z.number().optional(),
});
export type Eta = z.infer<typeof EtaSchema>;

export const NearbyStopsRequestSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius_m: z.number().int().positive().max(5000).default(500),
});
export type NearbyStopsRequest = z.infer<typeof NearbyStopsRequestSchema>;
