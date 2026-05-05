import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { MqttBridge } from '../live/mqtt.bridge.js';
import { EtaCalculator } from './eta.calculator.js';
import { EtaService, type EtaRow } from './eta.service.js';

/**
 * Listens to live position updates and, for each one, computes ETAs for the
 * nearest downstream stops on that route, then writes them to Redis.
 *
 * Performance note: route metadata (id, code, downstream stops with
 * distance_along_shape_m) is cached in-process keyed by `external_id`. The
 * cache is invalidated whenever the daily importer runs (we expose a `refresh`
 * hook for tests and admin tooling).
 */
@Injectable()
export class EtaWorker implements OnModuleInit {
  private readonly log = new Logger(EtaWorker.name);

  // Per-route cache keyed by `${cityCode}:${route_external_id}`
  private routeCache = new Map<
    string,
    {
      route_id: string;
      route_code: string;
      // Downstream lookup keyed by direction (we don't know the vehicle's
      // direction from the wire, so we compute against both and pick the one
      // that yields a valid downstream position).
      stops: {
        outbound: Array<{ stop_id: string; distance_along_shape_m: number }>;
        inbound: Array<{ stop_id: string; distance_along_shape_m: number }>;
      };
    }
  >();

  // Per-vehicle: last (lat, lng) for cheap "moving toward stop" check
  private vehicleLast = new Map<string, { lat: number; lng: number; t: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly bridge: MqttBridge,
    private readonly calc: EtaCalculator,
    private readonly etaSvc: EtaService,
  ) {}

  onModuleInit(): void {
    this.bridge.updates$.subscribe((u) => this.onUpdate(u).catch((err) => this.log.error(err)));
  }

  private async onUpdate(u: {
    vehicle_id: string;
    route_external_id: string;
    city: 'IST' | 'ANK';
    lat: number;
    lng: number;
    speed_kmh: number;
    heading: number;
    recorded_at: string;
  }): Promise<void> {
    const cacheKey = `${u.city}:${u.route_external_id}`;
    let cached = this.routeCache.get(cacheKey);
    if (!cached) {
      const loaded = await this.loadRoute(u.city, u.route_external_id);
      if (!loaded) return;
      cached = loaded;
      this.routeCache.set(cacheKey, cached);
    }

    // Pick the direction whose stop list is "ahead" of the vehicle by computing
    // where the vehicle currently projects. Without PostGIS we approximate via
    // nearest-by-haversine to a known stop's projection — good enough for the
    // heuristic; the real distance-along-shape is in route_stop.distance_along_shape_m.
    const projection = await this.projectVehicle(cached, u.lat, u.lng);
    if (!projection) return;

    const recordedAtMs = Date.parse(u.recorded_at) || Date.now();
    const nowMs = Date.now();

    const etas = this.calc.computeFor({
      vehicleDistanceM: projection.distanceM,
      routeId: cached.route_id,
      speedKmh: u.speed_kmh,
      recordedAtMs,
      nowMs,
      downstream: projection.downstream,
    });

    for (const e of etas) {
      const row: EtaRow = {
        route_id: cached.route_id,
        route_code: cached.route_code,
        headsign: null,
        vehicle_id: u.vehicle_id,
        eta_unix: e.eta_unix,
        eta_seconds: e.eta_seconds,
        confidence: e.confidence,
        source: 'live',
      };
      await this.etaSvc.writeLive(e.stop_id, row);
    }

    this.vehicleLast.set(u.vehicle_id, { lat: u.lat, lng: u.lng, t: nowMs });
  }

  private async loadRoute(
    city: 'IST' | 'ANK',
    routeExternalId: string,
  ): Promise<{
    route_id: string;
    route_code: string;
    stops: {
      outbound: Array<{ stop_id: string; distance_along_shape_m: number }>;
      inbound: Array<{ stop_id: string; distance_along_shape_m: number }>;
    };
  } | null> {
    const route = await this.prisma.route.findFirst({
      where: { external_id: routeExternalId, city: { code: city }, active: true },
    });
    if (!route) return null;
    const rs = await this.prisma.routeStop.findMany({
      where: { route_id: route.id, distance_along_shape_m: { not: null } },
      select: { stop_id: true, distance_along_shape_m: true, direction: true, sequence: true },
    });
    const ob = rs
      .filter((r) => r.direction === 'outbound')
      .sort((a, b) => a.sequence - b.sequence)
      .map((r) => ({ stop_id: r.stop_id, distance_along_shape_m: r.distance_along_shape_m! }));
    const ib = rs
      .filter((r) => r.direction === 'inbound')
      .sort((a, b) => a.sequence - b.sequence)
      .map((r) => ({ stop_id: r.stop_id, distance_along_shape_m: r.distance_along_shape_m! }));
    return { route_id: route.id, route_code: route.code, stops: { outbound: ob, inbound: ib } };
  }

  private async projectVehicle(
    cached: {
      route_id: string;
      stops: {
        outbound: Array<{ stop_id: string; distance_along_shape_m: number }>;
        inbound: Array<{ stop_id: string; distance_along_shape_m: number }>;
      };
    },
    lat: number,
    lng: number,
  ): Promise<{
    distanceM: number;
    downstream: Array<{ stop_id: string; distance_along_shape_m: number }>;
  } | null> {
    // Cheap nearest-stop heuristic: distance-along-shape = nearest route_stop's
    // distance. Precise at stops; between stops the ETA self-corrects within a
    // few seconds because we recompute on every position update. The ML model
    // in Phase 11 replaces this with a learned travel-time predictor.
    const rows = await this.prisma.$queryRaw<
      Array<{
        route_stop_distance: number;
        distance_m: number;
        direction: 'outbound' | 'inbound';
      }>
    >`
      SELECT rs.distance_along_shape_m AS route_stop_distance,
             ST_Distance(
               s.location::geography,
               ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
             )::float AS distance_m,
             rs.direction::text AS direction
      FROM route_stops rs
      JOIN stops s ON s.id = rs.stop_id
      WHERE rs.route_id = ${cached.route_id}::uuid
        AND rs.distance_along_shape_m IS NOT NULL
      ORDER BY distance_m ASC
      LIMIT 1;
    `;

    if (rows.length === 0) return null;
    const nearest = rows[0];
    const stops = nearest.direction === 'outbound' ? cached.stops.outbound : cached.stops.inbound;
    return {
      distanceM: nearest.route_stop_distance,
      downstream: stops.filter((s) => s.distance_along_shape_m > nearest.route_stop_distance),
    };
  }

  /** Test-/admin-only hook to wipe the route cache. */
  refresh(): void {
    this.routeCache.clear();
  }
}
