import { z } from 'zod';

export const SubscribeRouteSchema = z.object({
  kind: z.literal('route'),
  route_external_id: z.string().min(1).max(40),
  city: z.enum(['IST', 'ANK']),
});

export const SubscribeBboxSchema = z.object({
  kind: z.literal('bbox'),
  bbox: z.tuple([
    z.number().min(-180).max(180), // minLng
    z.number().min(-90).max(90), //  minLat
    z.number().min(-180).max(180), // maxLng
    z.number().min(-90).max(90), //  maxLat
  ]),
  city: z.enum(['IST', 'ANK']).optional(),
});

export const SubscribeRequestSchema = z.discriminatedUnion('kind', [
  SubscribeRouteSchema,
  SubscribeBboxSchema,
]);

export type SubscribeRequest = z.infer<typeof SubscribeRequestSchema>;

export interface VehicleUpdate {
  vehicle_id: string;
  route_external_id: string;
  city: 'IST' | 'ANK';
  lat: number;
  lng: number;
  speed_kmh: number;
  heading: number;
  recorded_at: string;
}

/**
 * Bbox sanity: rejects boxes whose diagonal exceeds ~50km. Bigger queries
 * have no business going to a single client (would be the whole-city snapshot
 * which is what /v1/stops/nearby is for, paginated).
 */
export function bboxDiagonalKm(bbox: [number, number, number, number]): number {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  if (minLng > maxLng || minLat > maxLat) return Infinity;
  // Equirectangular approximation
  const meanLat = ((minLat + maxLat) / 2) * (Math.PI / 180);
  const dLng = (maxLng - minLng) * 111.32 * Math.cos(meanLat);
  const dLat = (maxLat - minLat) * 110.57;
  return Math.hypot(dLng, dLat);
}

export function bboxContains(
  bbox: [number, number, number, number],
  lat: number,
  lng: number,
): boolean {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}
