import type { GtfsFeed, ParserStats } from '../gtfs/parser.js';

export interface FetchedFeed {
  source_url: string;
  feed: GtfsFeed;
  fetched_at: Date;
  parser_stats: ParserStats;
}

export interface StaticImporter {
  /** Stable id matching the operator code in DB (e.g. "iett", "ego"). */
  readonly operatorCode: string;
  /** Fetch + parse the source. Throw on network/parse failures. */
  fetch(): Promise<FetchedFeed>;
}

export interface ImportSummary {
  operator_code: string;
  source_url: string;
  routes_upserted: number;
  stops_upserted: number;
  route_stops_upserted: number;
  schedule_entries_upserted: number;
  duration_ms: number;
  drop_ratio?: { stops: number; routes: number };
}
