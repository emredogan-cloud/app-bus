# Runbook — Onboarding a new city (target: ≤ 1 week)

This is the playbook used for IZM, BUR, ANT during Phase 10. Each new city
should fit in this template; deviations get an ADR.

## Pre-flight checks (Day 1)

1. **Confirm GTFS-Static availability.** Either:
   - The operator publishes a public GTFS feed (preferred — write the URL into
     `GTFS_<OPERATOR>_URL`), or
   - A community mirror exists (`transitfeeds.com` or local), or
   - Stand up a scraper worker (3-5 days; out of this 1-week budget).
2. **Schema audit.** Run a parser dry-run against the feed:
   ```bash
   pnpm --filter @app-bus/api ts-node prisma/scripts/inspect-gtfs.ts <url>
   ```
   Expected output: agency / routes / stops / trips / stop_times / calendar /
   shapes row counts. Any zero counts trigger a deep-dive.
3. **Confirm timezone + locale.** All current Turkish cities are
   `Europe/Istanbul`. If onboarding outside Türkiye, add the timezone to the
   City row.

## Implementation (Days 2–4)

1. **Add the city** to the `CityCode` enum:
   - `apps/api/prisma/schema.prisma`
   - New migration `2026XXXXXXXXXX_phase10_<city>/migration.sql` with
     `ALTER TYPE "CityCode" ADD VALUE 'XXX'` + `INSERT INTO cities`.
2. **Add the importer.** Reuse `multi-city-importers.ts` if the feed is
   plain GTFS-Static; otherwise add a custom adapter implementing
   `StaticImporter` (see `iett.importer.ts` as a template).
3. **Wire** the new importer into `transit.module.ts` providers + push into
   `import.cron.ts` `sources`.
4. **Smoke-test** locally:
   ```bash
   pnpm --filter @app-bus/api prisma migrate dev
   GTFS_<OP>_URL=<url> pnpm --filter @app-bus/api dev
   curl localhost:3000/v1/cities/XXX/routes | head
   ```
5. **Configure mobile city switcher.** `apps/mobile/src/shared/cities.ts` lists
   the cities exposed in the picker (see Phase 10 commit for an example).

## Validation (Day 5)

- Daily import success rate ≥ 95% for 5 consecutive days.
- Stop count > 100, route count > 10. (Smaller cities below this are
  acceptable but raise a maintainer note.)
- ETA backtest p50 ≤ 120s (vs ≤ 90s for IST/ANK — smaller cities have
  spottier feeds; lean on schedule fallback).

## Rollout (Days 6–7)

- Per-city Datadog dashboard cloned from the IST template.
- Marketing landing page at `app-bus.tr/sehir/<code>` (Phase 9 page already
  template-driven).
- Per-city feature flag in GrowthBook so the city can be hidden from the
  switcher if data quality dips.
- Announce on local transit subreddits + university Discord channels.

## Rollback

If post-launch the data quality is unacceptable:

1. Set `cities.active = false` in the DB.
2. The mobile picker hides inactive cities automatically.
3. The cron continues to back-fill so we can re-enable later without data gaps.
