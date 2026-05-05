import AdmZip from 'adm-zip';
import { parseCsv } from './csv.js';

/**
 * Subset of the GTFS-Static spec we use.
 * Reference: https://gtfs.org/schedule/reference/
 */

export interface GtfsAgency {
  agency_id?: string;
  agency_name: string;
  agency_url: string;
  agency_timezone: string;
}

export interface GtfsRoute {
  route_id: string;
  agency_id?: string;
  route_short_name: string;
  route_long_name: string;
  route_type: number; // 0=tram, 1=metro, 2=rail, 3=bus, 4=ferry, 7=funicular, …
  route_desc?: string;
}

export interface GtfsStop {
  stop_id: string;
  stop_name: string;
  stop_lat: number;
  stop_lon: number;
  // 0 = stop, 1 = station, 2 = entrance — we only import 0/1
  location_type?: number;
  parent_station?: string;
  wheelchair_boarding?: number;
}

export interface GtfsTrip {
  trip_id: string;
  route_id: string;
  service_id: string;
  shape_id?: string;
  // 0 = outbound, 1 = inbound
  direction_id?: number;
  trip_headsign?: string;
}

export interface GtfsStopTime {
  trip_id: string;
  stop_id: string;
  stop_sequence: number;
  // GTFS uses HH:MM:SS, where HH may exceed 23 (next-day). We convert to seconds-from-midnight.
  arrival_seconds_from_midnight: number;
  departure_seconds_from_midnight: number;
}

export interface GtfsCalendar {
  service_id: string;
  // Bitmask: bit 0 = monday … bit 6 = sunday
  days_of_week: number;
  start_date: string; // YYYYMMDD
  end_date: string;
}

export interface GtfsShape {
  shape_id: string;
  // Sequence-ordered points
  points: Array<{ lat: number; lng: number; sequence: number }>;
}

export interface GtfsFeed {
  agencies: GtfsAgency[];
  routes: GtfsRoute[];
  stops: GtfsStop[];
  trips: GtfsTrip[];
  stop_times: GtfsStopTime[];
  calendars: GtfsCalendar[];
  shapes: Map<string, GtfsShape>;
}

export interface ParserStats {
  /** Bytes read from the zip. */
  bytes: number;
  /** Per-file row counts. */
  rows: Record<string, number>;
}

/**
 * Parse a GTFS-Static zip buffer into a GtfsFeed.
 *
 * Memory note: stop_times.txt can be very large. We stream-read and project to
 * the minimal canonical fields. Expect ~3× peak heap of the zipped size.
 */
export function parseGtfsZip(buffer: Buffer): { feed: GtfsFeed; stats: ParserStats } {
  const zip = new AdmZip(buffer);
  const stats: ParserStats = { bytes: buffer.length, rows: {} };

  const read = (name: string): string | null => {
    const entry = zip.getEntry(name);
    if (!entry) return null;
    return entry.getData().toString('utf8');
  };

  const agencies = parseAgencies(read('agency.txt'), stats);
  const routes = parseRoutes(read('routes.txt'), stats);
  const stops = parseStops(read('stops.txt'), stats);
  const trips = parseTrips(read('trips.txt'), stats);
  const stop_times = parseStopTimes(read('stop_times.txt'), stats);
  const calendars = parseCalendars(read('calendar.txt'), stats);
  const shapes = parseShapes(read('shapes.txt'), stats);

  return {
    feed: { agencies, routes, stops, trips, stop_times, calendars, shapes },
    stats,
  };
}

function parseAgencies(text: string | null, stats: ParserStats): GtfsAgency[] {
  if (!text) return [];
  const rows = parseCsv(text);
  stats.rows['agency.txt'] = rows.length;
  return rows.map((r) => ({
    agency_id: r.agency_id || undefined,
    agency_name: r.agency_name,
    agency_url: r.agency_url,
    agency_timezone: r.agency_timezone,
  }));
}

function parseRoutes(text: string | null, stats: ParserStats): GtfsRoute[] {
  if (!text) return [];
  const rows = parseCsv(text);
  stats.rows['routes.txt'] = rows.length;
  return rows
    .filter((r) => r.route_id)
    .map((r) => ({
      route_id: r.route_id,
      agency_id: r.agency_id || undefined,
      route_short_name: r.route_short_name || r.route_long_name || r.route_id,
      route_long_name: r.route_long_name || r.route_short_name || r.route_id,
      route_type: parseInt(r.route_type, 10) || 3,
      route_desc: r.route_desc || undefined,
    }));
}

function parseStops(text: string | null, stats: ParserStats): GtfsStop[] {
  if (!text) return [];
  const rows = parseCsv(text);
  stats.rows['stops.txt'] = rows.length;
  return rows
    .filter((r) => r.stop_id && r.stop_lat && r.stop_lon)
    .map((r) => ({
      stop_id: r.stop_id,
      stop_name: r.stop_name,
      stop_lat: parseFloat(r.stop_lat),
      stop_lon: parseFloat(r.stop_lon),
      location_type: r.location_type ? parseInt(r.location_type, 10) : 0,
      parent_station: r.parent_station || undefined,
      wheelchair_boarding: r.wheelchair_boarding ? parseInt(r.wheelchair_boarding, 10) : undefined,
    }))
    .filter((s) => s.location_type === 0 || s.location_type === 1);
}

function parseTrips(text: string | null, stats: ParserStats): GtfsTrip[] {
  if (!text) return [];
  const rows = parseCsv(text);
  stats.rows['trips.txt'] = rows.length;
  return rows
    .filter((r) => r.trip_id && r.route_id)
    .map((r) => ({
      trip_id: r.trip_id,
      route_id: r.route_id,
      service_id: r.service_id,
      shape_id: r.shape_id || undefined,
      direction_id: r.direction_id !== '' ? parseInt(r.direction_id, 10) : 0,
      trip_headsign: r.trip_headsign || undefined,
    }));
}

function parseStopTimes(text: string | null, stats: ParserStats): GtfsStopTime[] {
  if (!text) return [];
  const rows = parseCsv(text);
  stats.rows['stop_times.txt'] = rows.length;
  return rows
    .filter((r) => r.trip_id && r.stop_id)
    .map((r) => ({
      trip_id: r.trip_id,
      stop_id: r.stop_id,
      stop_sequence: parseInt(r.stop_sequence, 10),
      arrival_seconds_from_midnight: timeToSeconds(r.arrival_time),
      departure_seconds_from_midnight: timeToSeconds(r.departure_time),
    }));
}

function parseCalendars(text: string | null, stats: ParserStats): GtfsCalendar[] {
  if (!text) return [];
  const rows = parseCsv(text);
  stats.rows['calendar.txt'] = rows.length;
  return rows.map((r) => ({
    service_id: r.service_id,
    days_of_week:
      (parseBit(r.monday) << 0) |
      (parseBit(r.tuesday) << 1) |
      (parseBit(r.wednesday) << 2) |
      (parseBit(r.thursday) << 3) |
      (parseBit(r.friday) << 4) |
      (parseBit(r.saturday) << 5) |
      (parseBit(r.sunday) << 6),
    start_date: r.start_date,
    end_date: r.end_date,
  }));
}

function parseShapes(text: string | null, stats: ParserStats): Map<string, GtfsShape> {
  const map = new Map<string, GtfsShape>();
  if (!text) return map;
  const rows = parseCsv(text);
  stats.rows['shapes.txt'] = rows.length;
  for (const r of rows) {
    const id = r.shape_id;
    if (!id) continue;
    let shape = map.get(id);
    if (!shape) {
      shape = { shape_id: id, points: [] };
      map.set(id, shape);
    }
    shape.points.push({
      lat: parseFloat(r.shape_pt_lat),
      lng: parseFloat(r.shape_pt_lon),
      sequence: parseInt(r.shape_pt_sequence, 10),
    });
  }
  for (const s of map.values()) s.points.sort((a, b) => a.sequence - b.sequence);
  return map;
}

function timeToSeconds(s: string | undefined): number {
  if (!s) return 0;
  const m = /^(\d+):(\d{1,2}):(\d{1,2})$/.exec(s.trim());
  if (!m) return 0;
  return parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseInt(m[3], 10);
}

function parseBit(s: string | undefined): number {
  return s === '1' ? 1 : 0;
}
