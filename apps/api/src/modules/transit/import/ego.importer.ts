import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnv } from '../../../config/env.js';
import { parseGtfsZip } from '../gtfs/parser.js';
import type { FetchedFeed, StaticImporter } from './importer.types.js';

/**
 * EGO (Ankara) — does NOT (as of 2026-Q1) publish a clean GTFS-Static feed.
 * Strategy:
 *   • If GTFS_EGO_URL is set, treat it as a GTFS-Static URL (someone has
 *     scraped + republished the feed, e.g. transitfeeds.com or a community
 *     mirror). This is the preferred path.
 *   • Otherwise, throw — operator should configure an alternative source via
 *     a custom adapter. We deliberately do NOT scrape ego.gov.tr from the API
 *     pod (rate-limit + politeness); that work belongs in a dedicated
 *     workers/ego-scraper service.
 *
 * Documented scrape target for the future scraper:
 *   https://www.ego.gov.tr/tr/sayfa/3833/otobus-saatleri
 *   (HTML, requires per-route page fetch + table parse + geocoding of stop names.)
 */
@Injectable()
export class EgoImporter implements StaticImporter {
  readonly operatorCode = 'ego';
  private readonly log = new Logger(EgoImporter.name);

  constructor(private readonly config: ConfigService<AppEnv, true>) {}

  async fetch(): Promise<FetchedFeed> {
    const url = this.config.get<string>('GTFS_EGO_URL') ?? '';
    if (!url) {
      throw new Error(
        'GTFS_EGO_URL not configured. EGO does not publish GTFS directly; provide a community ' +
          'mirror URL or stand up a scraper worker (see ego.importer.ts comments).',
      );
    }

    this.log.log(`fetching EGO GTFS from ${url}`);
    const res = await fetch(url, {
      headers: { 'user-agent': 'app-bus/0.0.0 (+https://app-bus.tr)' },
    });
    if (!res.ok) throw new Error(`EGO fetch failed: ${res.status} ${res.statusText}`);
    const buf = Buffer.from(await res.arrayBuffer());

    const { feed, stats } = parseGtfsZip(buf);
    this.log.log(`EGO parsed: ${JSON.stringify(stats.rows)}`);
    return { source_url: url, feed, fetched_at: new Date(), parser_stats: stats };
  }
}
