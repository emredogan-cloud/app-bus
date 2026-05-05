import type { GtfsStop } from './parser.js';

/**
 * Stop deduplication: collapse stops within `mergeRadiusM` of an existing stop
 * with the same canonical name into the canonical record.
 *
 * Real-world transit feeds list many "twin" stops on opposite sides of a road
 * with slightly different coordinates and the same name; collapsing them to
 * one user-visible stop reduces clutter on the map.
 *
 * Returned mapping: GTFS stop_id → canonical stop_id (may be the same).
 */
export function dedupeStops(
  stops: GtfsStop[],
  opts: { mergeRadiusM?: number } = {},
): { canonical: GtfsStop[]; mapping: Map<string, string> } {
  const radiusM = opts.mergeRadiusM ?? 30;
  const radiusDeg = radiusM / 111_320; // ~1 degree latitude ≈ 111.32 km

  const buckets = new Map<string, GtfsStop[]>();
  for (const s of stops) {
    const key = canonicalName(s.stop_name);
    const arr = buckets.get(key) ?? [];
    arr.push(s);
    buckets.set(key, arr);
  }

  const canonical: GtfsStop[] = [];
  const mapping = new Map<string, string>();

  for (const arr of buckets.values()) {
    // Greedy: O(n^2) per bucket — buckets are small in practice
    const used: GtfsStop[] = [];
    for (const s of arr) {
      const near = used.find(
        (u) =>
          Math.abs(u.stop_lat - s.stop_lat) < radiusDeg &&
          Math.abs(u.stop_lon - s.stop_lon) < radiusDeg / Math.cos((s.stop_lat * Math.PI) / 180),
      );
      if (near) {
        mapping.set(s.stop_id, near.stop_id);
      } else {
        used.push(s);
        mapping.set(s.stop_id, s.stop_id);
      }
    }
    canonical.push(...used);
  }
  return { canonical, mapping };
}

// Turkish-aware canonical name. JS's toLowerCase is locale-insensitive and
// keeps the dotless `ı` (U+0131) distinct from `i`; we explicitly fold them
// alongside the other Turkish-specific letters. Used for matching only —
// the original name is preserved for display.
const TURKISH_FOLD: Record<string, string> = {
  ı: 'i',
  İ: 'i',
  ş: 's',
  Ş: 's',
  ç: 'c',
  Ç: 'c',
  ü: 'u',
  Ü: 'u',
  ö: 'o',
  Ö: 'o',
  ğ: 'g',
  Ğ: 'g',
};

function canonicalName(s: string): string {
  let folded = '';
  for (const ch of s) folded += TURKISH_FOLD[ch] ?? ch;
  return folded
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
