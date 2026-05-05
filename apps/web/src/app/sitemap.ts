import type { MetadataRoute } from 'next';

const BASE = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3001';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Phase 9 ships a static sitemap; nightly re-generation against the API
  // (Phase 9.5) will populate per-stop entries from /v1/stops?city=… once
  // the bulk-listing endpoint is added.
  return [
    { url: `${BASE}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/sehir/IST`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/sehir/ANK`, changeFrequency: 'daily', priority: 0.8 },
  ];
}
