import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnv } from '../../../config/env.js';
import { parseGtfsZip } from '../gtfs/parser.js';
import type { FetchedFeed, StaticImporter } from './importer.types.js';

/**
 * İETT (Istanbul) — operates an open data portal that publishes GTFS-Static
 * weekly. Source URL is configured via env to allow swapping endpoints
 * without a code deploy if the IBB data team relocates the feed.
 *
 * If the feed temporarily disappears we surface a clear error; the cron job
 * records the failure in import_runs and pages on > 24h staleness.
 */
@Injectable()
export class IettImporter implements StaticImporter {
  readonly operatorCode = 'iett';
  private readonly log = new Logger(IettImporter.name);

  constructor(private readonly config: ConfigService<AppEnv, true>) {}

  async fetch(): Promise<FetchedFeed> {
    const url = this.config.get<string>('GTFS_IETT_URL') ?? '';
    if (!url) throw new Error('GTFS_IETT_URL not configured');

    this.log.log(`fetching İETT GTFS from ${url}`);
    const res = await fetch(url, {
      headers: { 'user-agent': 'app-bus/0.0.0 (+https://app-bus.tr)' },
    });
    if (!res.ok) throw new Error(`İETT fetch failed: ${res.status} ${res.statusText}`);
    const buf = Buffer.from(await res.arrayBuffer());

    const { feed, stats } = parseGtfsZip(buf);
    this.log.log(`İETT parsed: ${JSON.stringify(stats.rows)}`);
    return { source_url: url, feed, fetched_at: new Date(), parser_stats: stats };
  }
}
