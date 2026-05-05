import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { FetchedFeed } from './importer.types.js';
import type { ImportSummary } from './importer.types.js';
import { dedupeStops } from '../gtfs/dedupe.js';

const MODE_FROM_GTFS: Record<number, 'bus' | 'metro' | 'tram' | 'ferry' | 'funicular'> = {
  0: 'tram',
  1: 'metro',
  2: 'metro', // commuter rail → metro for our taxonomy
  3: 'bus',
  4: 'ferry',
  5: 'funicular',
  6: 'tram', // aerial lift → tram
  7: 'funicular',
  11: 'bus', // trolleybus
};

@Injectable()
export class ImportService {
  private readonly log = new Logger(ImportService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Idempotent upsert pipeline.
   * Strategy: bulk upsert by (operator_id, external_id). Soft-deactivate any
   * record absent from the latest feed by setting active=false (rather than
   * hard-deleting, which would cascade refresh tokens / favorites etc.).
   * Returns counts + drop ratio so the cron job can alert on suspicious deltas.
   */
  async runImport(operatorCode: string, fetched: FetchedFeed): Promise<ImportSummary> {
    const startedAt = Date.now();

    const operator = await this.prisma.operator.findFirst({
      where: { code: operatorCode },
      include: { city: true },
    });
    if (!operator) throw new Error(`operator not found: ${operatorCode}`);

    // Record import start
    const run = await this.prisma.importRun.create({
      data: {
        operator_id: operator.id,
        source_url: fetched.source_url,
        status: 'running',
      },
    });

    try {
      const { feed } = fetched;

      // 1) Stops — dedupe twin stops within 30m, then upsert.
      const { canonical: stops, mapping: stopIdMapping } = dedupeStops(feed.stops);
      const stopsBefore = await this.prisma.stop.count({
        where: { operator_id: operator.id, active: true },
      });
      const stopExternalIds = new Set<string>();

      for (const s of stops) {
        await this.prisma.stop.upsert({
          where: { operator_id_external_id: { operator_id: operator.id, external_id: s.stop_id } },
          create: {
            operator_id: operator.id,
            city_id: operator.city_id,
            external_id: s.stop_id,
            name_tr: s.stop_name,
            name_en: null,
            lat: s.stop_lat,
            lng: s.stop_lon,
            accessibility_features:
              s.wheelchair_boarding === 1 ? { wheelchair: true } : Prisma.JsonNull,
            active: true,
          },
          update: {
            name_tr: s.stop_name,
            lat: s.stop_lat,
            lng: s.stop_lon,
            active: true,
          },
        });
        stopExternalIds.add(s.stop_id);
      }
      // Soft-deactivate stops that disappeared from the feed
      await this.prisma.stop.updateMany({
        where: {
          operator_id: operator.id,
          external_id: { notIn: [...stopExternalIds] },
          active: true,
        },
        data: { active: false },
      });
      const stopsAfter = await this.prisma.stop.count({
        where: { operator_id: operator.id, active: true },
      });

      // 2) Routes
      const routesBefore = await this.prisma.route.count({
        where: { operator_id: operator.id, active: true },
      });
      const routeExternalIds = new Set<string>();
      // Build trip→route map for shape selection
      const routeShapeId = new Map<string, string | undefined>();
      for (const t of feed.trips) {
        if (!routeShapeId.has(t.route_id) && t.shape_id) routeShapeId.set(t.route_id, t.shape_id);
      }

      for (const r of feed.routes) {
        const mode = MODE_FROM_GTFS[r.route_type] ?? 'bus';
        const family = familyId(r.route_short_name);
        await this.prisma.route.upsert({
          where: { operator_id_external_id: { operator_id: operator.id, external_id: r.route_id } },
          create: {
            operator_id: operator.id,
            city_id: operator.city_id,
            external_id: r.route_id,
            code: r.route_short_name,
            name_tr: r.route_long_name,
            mode,
            route_family_id: family,
            active: true,
          },
          update: {
            code: r.route_short_name,
            name_tr: r.route_long_name,
            mode,
            route_family_id: family,
            active: true,
          },
        });
        routeExternalIds.add(r.route_id);

        // Update PostGIS shape via raw SQL (Prisma doesn't model geometry).
        const shape = routeShapeId.get(r.route_id);
        const shapeRow = shape ? feed.shapes.get(shape) : undefined;
        if (shapeRow && shapeRow.points.length >= 2) {
          const wkt = `LINESTRING(${shapeRow.points.map((p) => `${p.lng} ${p.lat}`).join(', ')})`;
          await this.prisma.$executeRaw`
            UPDATE routes SET shape = ST_SetSRID(ST_GeomFromText(${wkt}), 4326)
            WHERE operator_id = ${operator.id}::uuid
              AND external_id = ${r.route_id};
          `;
        }
      }
      await this.prisma.route.updateMany({
        where: {
          operator_id: operator.id,
          external_id: { notIn: [...routeExternalIds] },
          active: true,
        },
        data: { active: false },
      });
      const routesAfter = await this.prisma.route.count({
        where: { operator_id: operator.id, active: true },
      });

      // 3) Build (trip → ordered stops) and pick representative trip per (route, direction).
      // We don't try to model every trip; the canonical "stop sequence" is the
      // representative trip's sequence. Schedules use all trips' departure times.

      // Trip header lookup
      const tripsByRoute = new Map<
        string,
        Array<{ trip_id: string; direction: 0 | 1; service_id: string }>
      >();
      for (const t of feed.trips) {
        const arr = tripsByRoute.get(t.route_id) ?? [];
        arr.push({
          trip_id: t.trip_id,
          direction: (t.direction_id ?? 0) as 0 | 1,
          service_id: t.service_id,
        });
        tripsByRoute.set(t.route_id, arr);
      }

      // Stop times grouped by trip_id, ordered by sequence
      const stopTimesByTrip = new Map<string, typeof feed.stop_times>();
      for (const st of feed.stop_times) {
        const arr = stopTimesByTrip.get(st.trip_id) ?? [];
        arr.push(st);
        stopTimesByTrip.set(st.trip_id, arr);
      }
      for (const arr of stopTimesByTrip.values())
        arr.sort((a, b) => a.stop_sequence - b.stop_sequence);

      // Calendar lookup
      const calendarByService = new Map<string, number>();
      for (const c of feed.calendars) calendarByService.set(c.service_id, c.days_of_week);

      // 4) Route stops (representative trip per direction)
      let routeStopsUpserted = 0;
      // Wipe existing route_stops + schedules for this operator's active routes — full rewrite per import is simpler than diffing.
      await this.prisma.$executeRaw`
        DELETE FROM route_stops
         WHERE route_id IN (SELECT id FROM routes WHERE operator_id = ${operator.id}::uuid);
      `;
      await this.prisma.$executeRaw`
        DELETE FROM schedule_entries
         WHERE route_id IN (SELECT id FROM routes WHERE operator_id = ${operator.id}::uuid);
      `;

      for (const [routeExternalId, trips] of tripsByRoute.entries()) {
        const dbRoute = await this.prisma.route.findUnique({
          where: {
            operator_id_external_id: { operator_id: operator.id, external_id: routeExternalId },
          },
        });
        if (!dbRoute) continue;

        for (const direction of [0, 1] as const) {
          const tripsInDir = trips.filter((t) => t.direction === direction);
          if (tripsInDir.length === 0) continue;
          // Pick the trip with the most stops as the canonical sequence
          const repTrip = tripsInDir
            .map((t) => ({ t, stops: stopTimesByTrip.get(t.trip_id) ?? [] }))
            .sort((a, b) => b.stops.length - a.stops.length)[0];
          if (!repTrip || repTrip.stops.length === 0) continue;

          for (let i = 0; i < repTrip.stops.length; i++) {
            const st = repTrip.stops[i];
            const canonicalStopId = stopIdMapping.get(st.stop_id) ?? st.stop_id;
            const dbStop = await this.prisma.stop.findUnique({
              where: {
                operator_id_external_id: { operator_id: operator.id, external_id: canonicalStopId },
              },
            });
            if (!dbStop) continue;
            await this.prisma.routeStop.create({
              data: {
                route_id: dbRoute.id,
                stop_id: dbStop.id,
                sequence: i,
                direction: direction === 0 ? 'outbound' : 'inbound',
              },
            });
            routeStopsUpserted++;
          }
        }
      }

      // 5) Schedule entries: for every (trip, stop_time) → (route, stop, direction, days, departure_seconds)
      let schedules = 0;
      const SCHEDULE_BATCH = 1000;
      const buffer: Array<{
        route_id: string;
        stop_id: string;
        direction: 'outbound' | 'inbound';
        days_of_week: number;
        departure_seconds_from_midnight: number;
      }> = [];

      for (const trip of feed.trips) {
        const days = calendarByService.get(trip.service_id);
        if (!days) continue;
        const dbRoute = await this.prisma.route.findUnique({
          where: {
            operator_id_external_id: { operator_id: operator.id, external_id: trip.route_id },
          },
        });
        if (!dbRoute) continue;
        const sts = stopTimesByTrip.get(trip.trip_id) ?? [];
        const dir: 'outbound' | 'inbound' = (trip.direction_id ?? 0) === 0 ? 'outbound' : 'inbound';
        for (const st of sts) {
          const canonical = stopIdMapping.get(st.stop_id) ?? st.stop_id;
          const dbStop = await this.prisma.stop.findUnique({
            where: {
              operator_id_external_id: { operator_id: operator.id, external_id: canonical },
            },
          });
          if (!dbStop) continue;
          buffer.push({
            route_id: dbRoute.id,
            stop_id: dbStop.id,
            direction: dir,
            days_of_week: days,
            departure_seconds_from_midnight: st.departure_seconds_from_midnight,
          });
          if (buffer.length >= SCHEDULE_BATCH) {
            await this.prisma.scheduleEntry.createMany({ data: buffer });
            schedules += buffer.length;
            buffer.length = 0;
          }
        }
      }
      if (buffer.length) {
        await this.prisma.scheduleEntry.createMany({ data: buffer });
        schedules += buffer.length;
      }

      // 6) Distance-along-shape (Phase 5 ETA precomputation)
      // Compute via PostGIS for every route_stop where we have a shape.
      await this.prisma.$executeRaw`
        UPDATE route_stops rs
           SET distance_along_shape_m = ST_Length(
             ST_Transform(
               ST_LineSubstring(
                 r.shape,
                 0,
                 ST_LineLocatePoint(r.shape, s.location)
               ),
               3857
             )
           )::int
        FROM routes r, stops s
        WHERE rs.route_id = r.id
          AND rs.stop_id  = s.id
          AND r.operator_id = ${operator.id}::uuid
          AND r.shape IS NOT NULL;
      `;

      const summary: ImportSummary = {
        operator_code: operator.code,
        source_url: fetched.source_url,
        routes_upserted: routesAfter,
        stops_upserted: stopsAfter,
        route_stops_upserted: routeStopsUpserted,
        schedule_entries_upserted: schedules,
        duration_ms: Date.now() - startedAt,
        drop_ratio: {
          stops: stopsBefore > 0 ? 1 - stopsAfter / stopsBefore : 0,
          routes: routesBefore > 0 ? 1 - routesAfter / routesBefore : 0,
        },
      };

      // Alert on suspicious deltas (>5% drop signals broken upstream).
      if (
        summary.drop_ratio &&
        (summary.drop_ratio.stops > 0.05 || summary.drop_ratio.routes > 0.05)
      ) {
        this.log.warn(
          `import drop > 5% — operator=${operator.code} stops=${(summary.drop_ratio.stops * 100).toFixed(1)}% routes=${(summary.drop_ratio.routes * 100).toFixed(1)}%`,
        );
      }

      await this.prisma.importRun.update({
        where: { id: run.id },
        data: {
          status: 'success',
          stats: summary as unknown as Prisma.InputJsonValue,
          finished_at: new Date(),
        },
      });

      this.log.log(`import ok: ${JSON.stringify(summary)}`);
      return summary;
    } catch (err) {
      const msg = (err as Error).message;
      await this.prisma.importRun.update({
        where: { id: run.id },
        data: { status: 'failed', error: msg, finished_at: new Date() },
      });
      throw err;
    }
  }
}

function familyId(code: string): string | null {
  const m = /^([A-Z0-9]+?)(\d{0,2})?$/.exec(code);
  if (!m) return null;
  // "500T" → "500", "500T1" → "500", "M2" → "M"
  return m[1] ?? null;
}
