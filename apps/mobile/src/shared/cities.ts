/**
 * Cities supported by the app, ordered by launch sequence.
 *
 * The picker consults `/v1/cities` at runtime to show only `active=true` rows;
 * this module provides display metadata (Turkish + English names, default
 * coordinates) for offline rendering.
 */
export const CITIES = [
  { code: 'IST', name_tr: 'İstanbul', name_en: 'Istanbul', center: { lat: 41.0082, lng: 28.9784 } },
  { code: 'ANK', name_tr: 'Ankara', name_en: 'Ankara', center: { lat: 39.9334, lng: 32.8597 } },
  { code: 'IZM', name_tr: 'İzmir', name_en: 'Izmir', center: { lat: 38.4192, lng: 27.1287 } },
  { code: 'BUR', name_tr: 'Bursa', name_en: 'Bursa', center: { lat: 40.1885, lng: 29.061 } },
  { code: 'ANT', name_tr: 'Antalya', name_en: 'Antalya', center: { lat: 36.8969, lng: 30.7133 } },
] as const;

export type CityCode = (typeof CITIES)[number]['code'];

/** Find the city whose center is closest to the given location. */
export function nearestCity(lat: number, lng: number): CityCode {
  let best: CityCode = 'IST';
  let bestKm = Infinity;
  for (const c of CITIES) {
    const km = haversineKm(lat, lng, c.center.lat, c.center.lng);
    if (km < bestKm) {
      bestKm = km;
      best = c.code;
    }
  }
  return best;
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const a = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(a));
}
