import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseGtfsZip } from '../gtfs/parser.js';
import type { FetchedFeed, StaticImporter } from './importer.types.js';
import type { AppEnv } from '../../../config/env.js';

/**
 * Phase 10: Generic GTFS-Static importer factory used for cities #3-5.
 *
 * Each city has its own env-configurable URL:
 *   GTFS_ESHOT_URL    (İzmir / ESHOT)
 *   GTFS_BURULAS_URL  (Bursa / BURULAŞ)
 *   GTFS_ANTALYA_URL  (Antalya Büyükşehir)
 *
 * They share the same fetch/parse path as IETT — only the URL differs.
 * If a feed is missing the importer logs and idles instead of crashing the
 * cron, so per-city outages don't block the others.
 */
function makeImporter(
  operatorCode: string,
  urlEnvKey: keyof AppEnv,
): {
  new (config: ConfigService<AppEnv, true>): StaticImporter;
} {
  @Injectable()
  class GenericImporter implements StaticImporter {
    readonly operatorCode = operatorCode;
    private readonly log = new Logger(`${operatorCode}-importer`);

    constructor(private readonly config: ConfigService<AppEnv, true>) {}

    async fetch(): Promise<FetchedFeed> {
      const url = this.config.get<string>(urlEnvKey as never) as string | undefined;
      if (!url) {
        throw new Error(
          `${operatorCode}: ${String(urlEnvKey)} not configured. Provide a community-mirror GTFS URL or stand up a scraper worker.`,
        );
      }
      this.log.log(`fetching ${operatorCode} GTFS from ${url}`);
      const res = await fetch(url, { headers: { 'user-agent': 'app-bus/0.0.0' } });
      if (!res.ok) throw new Error(`${operatorCode} fetch ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const { feed, stats } = parseGtfsZip(buf);
      return { source_url: url, feed, fetched_at: new Date(), parser_stats: stats };
    }
  }
  return GenericImporter;
}

export const EshotImporter = makeImporter('eshot', 'GTFS_ESHOT_URL');
export const BurulasImporter = makeImporter('burulas', 'GTFS_BURULAS_URL');
export const AntalyaImporter = makeImporter('antalya', 'GTFS_ANTALYA_URL');
