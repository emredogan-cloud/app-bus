import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CityCode, TransitMode } from '@prisma/client';

export interface NearbyStopRow {
  id: string;
  city_id: string;
  external_id: string;
  name_tr: string;
  name_en: string | null;
  lat: number;
  lng: number;
  distance_m: number;
}

@Injectable()
export class TransitQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async listCities() {
    return this.prisma.city.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true, timezone: true },
    });
  }

  async listRoutes(cityCode: CityCode, mode?: TransitMode, cursor?: string, limit = 50) {
    const city = await this.prisma.city.findUnique({ where: { code: cityCode } });
    if (!city) return { items: [], next_cursor: null };
    const items = await this.prisma.route.findMany({
      where: {
        city_id: city.id,
        active: true,
        ...(mode ? { mode } : {}),
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      take: limit + 1,
      orderBy: { id: 'asc' },
      select: {
        id: true,
        code: true,
        name_tr: true,
        name_en: true,
        mode: true,
        route_family_id: true,
      },
    });
    const next_cursor = items.length > limit ? items.pop()!.id : null;
    return { items, next_cursor };
  }

  async getRoute(id: string) {
    const r = await this.prisma.route.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        name_tr: true,
        name_en: true,
        mode: true,
        city_id: true,
        active: true,
      },
    });
    if (!r) return null;
    // Fetch shape as encoded polyline using raw SQL
    const shape = await this.prisma.$queryRaw<Array<{ shape: string | null }>>`
      SELECT ST_AsEncodedPolyline(shape) AS shape FROM routes WHERE id = ${id}::uuid
    `;
    return { ...r, polyline: shape[0]?.shape ?? null };
  }

  async stopsNearby(input: { lat: number; lng: number; radiusM: number; limit?: number }) {
    const { lat, lng, radiusM } = input;
    const limit = Math.min(input.limit ?? 50, 200);
    // Use ST_DWithin with geography casts so the radius is meters and the GIST
    // index on `location` is consulted. ST_Distance is fine in SELECT (per row),
    // never in WHERE.
    return this.prisma.$queryRaw<NearbyStopRow[]>`
      SELECT id, city_id, external_id, name_tr, name_en, lat, lng,
             ST_Distance(location::geography, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography)::float AS distance_m
        FROM stops
       WHERE active = true
         AND ST_DWithin(location::geography, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, ${radiusM})
       ORDER BY distance_m ASC
       LIMIT ${limit};
    `;
  }

  async getStop(id: string) {
    const stop = await this.prisma.stop.findUnique({
      where: { id },
      select: {
        id: true,
        external_id: true,
        name_tr: true,
        name_en: true,
        lat: true,
        lng: true,
        accessibility_features: true,
        active: true,
      },
    });
    if (!stop) return null;

    const lines = await this.prisma.routeStop.findMany({
      where: { stop_id: id },
      orderBy: [{ direction: 'asc' }, { sequence: 'asc' }],
      select: {
        direction: true,
        sequence: true,
        route: { select: { id: true, code: true, name_tr: true, name_en: true, mode: true } },
      },
    });

    return { ...stop, lines };
  }

  async search(input: { q: string; cityCode?: CityCode; limit?: number }) {
    const q = input.q.trim();
    if (q.length < 2) return { stops: [], routes: [] };
    const limit = Math.min(input.limit ?? 20, 50);
    const city = input.cityCode
      ? await this.prisma.city.findUnique({ where: { code: input.cityCode } })
      : null;

    // pg_trgm + unaccent: matches "kadıköy" with input "kadikoy".
    // similarity() is the rank; we drop matches under 0.2 to filter noise.
    const stops = await this.prisma.$queryRaw<
      Array<{ id: string; name_tr: string; lat: number; lng: number; sim: number }>
    >`
      SELECT id, name_tr, lat, lng,
             similarity(LOWER(unaccent(name_tr)), LOWER(unaccent(${q}))) AS sim
        FROM stops
       WHERE active = true
         AND ${city ? Prisma.sql`city_id = ${city.id}::uuid AND` : Prisma.empty}
             LOWER(unaccent(name_tr)) % LOWER(unaccent(${q}))
       ORDER BY sim DESC
       LIMIT ${limit};
    `;

    const routes = await this.prisma.$queryRaw<
      Array<{ id: string; code: string; name_tr: string; mode: string; sim: number }>
    >`
      SELECT id, code, name_tr, mode::text AS mode,
             GREATEST(
               similarity(LOWER(unaccent(code)), LOWER(unaccent(${q}))),
               similarity(LOWER(unaccent(name_tr)), LOWER(unaccent(${q})))
             ) AS sim
        FROM routes
       WHERE active = true
         AND ${city ? Prisma.sql`city_id = ${city.id}::uuid AND` : Prisma.empty}
             (LOWER(unaccent(code)) % LOWER(unaccent(${q}))
              OR LOWER(unaccent(name_tr)) % LOWER(unaccent(${q})))
       ORDER BY sim DESC
       LIMIT ${limit};
    `;

    return { stops, routes };
  }
}

// Late import to avoid a circular type pull from the Prisma re-export.
import { Prisma } from '@prisma/client';
