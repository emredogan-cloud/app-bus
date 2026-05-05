-- Phase 2: static transit data (cities, operators, routes, stops, schedules).

-- Enums
CREATE TYPE "CityCode"     AS ENUM ('IST', 'ANK');
CREATE TYPE "SourceType"   AS ENUM ('GTFS_STATIC', 'GTFS_RT', 'CUSTOM_REST', 'CUSTOM_SCRAPE');
CREATE TYPE "TransitMode"  AS ENUM ('bus', 'metro', 'tram', 'ferry', 'funicular');
CREATE TYPE "Direction"    AS ENUM ('outbound', 'inbound');

-- cities
CREATE TABLE "cities" (
  "id"         UUID           NOT NULL DEFAULT gen_random_uuid(),
  "code"       "CityCode"     NOT NULL,
  "name"       VARCHAR(120)   NOT NULL,
  "timezone"   VARCHAR(40)    NOT NULL,
  "active"     BOOLEAN        NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "cities_code_key" ON "cities"("code");

-- bbox geometry (added separately to keep Prisma schema clean)
SELECT AddGeometryColumn('cities', 'bbox', 4326, 'POLYGON', 2);

-- operators
CREATE TABLE "operators" (
  "id"          UUID           NOT NULL DEFAULT gen_random_uuid(),
  "city_id"     UUID           NOT NULL,
  "code"        VARCHAR(40)    NOT NULL,
  "name"        VARCHAR(120)   NOT NULL,
  "source_type" "SourceType"   NOT NULL,
  "api_config"  JSONB          NOT NULL,
  "active"      BOOLEAN        NOT NULL DEFAULT true,
  "created_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "operators_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "operators_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "operators_city_id_code_key" ON "operators"("city_id", "code");

-- routes (shape geometry added below)
CREATE TABLE "routes" (
  "id"              UUID           NOT NULL DEFAULT gen_random_uuid(),
  "operator_id"     UUID           NOT NULL,
  "city_id"         UUID           NOT NULL,
  "external_id"     VARCHAR(120)   NOT NULL,
  "code"            VARCHAR(40)    NOT NULL,
  "name_tr"         VARCHAR(255)   NOT NULL,
  "name_en"         VARCHAR(255),
  "mode"            "TransitMode"  NOT NULL,
  "route_family_id" VARCHAR(40),
  "active"          BOOLEAN        NOT NULL DEFAULT true,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "routes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "routes_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "operators"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "routes_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "routes_operator_id_external_id_key" ON "routes"("operator_id", "external_id");
CREATE INDEX "routes_city_id_mode_active_idx" ON "routes"("city_id", "mode", "active");
CREATE INDEX "routes_code_idx" ON "routes"("code");

SELECT AddGeometryColumn('routes', 'shape', 4326, 'LINESTRING', 2);

-- stops (POINT geometry + GIST index)
CREATE TABLE "stops" (
  "id"                     UUID             NOT NULL DEFAULT gen_random_uuid(),
  "operator_id"            UUID             NOT NULL,
  "city_id"                UUID             NOT NULL,
  "external_id"            VARCHAR(120)     NOT NULL,
  "name_tr"                VARCHAR(255)     NOT NULL,
  "name_en"                VARCHAR(255),
  "lat"                    DOUBLE PRECISION NOT NULL,
  "lng"                    DOUBLE PRECISION NOT NULL,
  "accessibility_features" JSONB,
  "active"                 BOOLEAN          NOT NULL DEFAULT true,
  "created_at"             TIMESTAMPTZ(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"             TIMESTAMPTZ(6)   NOT NULL,
  CONSTRAINT "stops_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stops_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "operators"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "stops_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "stops_operator_id_external_id_key" ON "stops"("operator_id", "external_id");
CREATE INDEX "stops_city_id_idx" ON "stops"("city_id");

-- Canonical PostGIS geometry, kept in sync with lat/lng via trigger.
SELECT AddGeometryColumn('stops', 'location', 4326, 'POINT', 2);
CREATE INDEX "stops_location_gix" ON "stops" USING GIST ("location");

CREATE OR REPLACE FUNCTION sync_stop_location() RETURNS TRIGGER AS $$
BEGIN
  NEW.location = ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stops_sync_location
BEFORE INSERT OR UPDATE OF lat, lng ON "stops"
FOR EACH ROW EXECUTE FUNCTION sync_stop_location();

-- Trigram + unaccent indexes for Turkish-aware fuzzy search.
-- Materialized "search_text" stays inline (use lower(unaccent(...)) at query time).
CREATE INDEX "stops_name_trgm_idx" ON "stops" USING GIN (LOWER(unaccent("name_tr")) gin_trgm_ops);
CREATE INDEX "routes_code_trgm_idx" ON "routes" USING GIN (LOWER(unaccent("code")) gin_trgm_ops);
CREATE INDEX "routes_name_trgm_idx" ON "routes" USING GIN (LOWER(unaccent("name_tr")) gin_trgm_ops);

-- route_stops
CREATE TABLE "route_stops" (
  "id"                     UUID         NOT NULL DEFAULT gen_random_uuid(),
  "route_id"               UUID         NOT NULL,
  "stop_id"                UUID         NOT NULL,
  "sequence"               INT          NOT NULL,
  "direction"              "Direction"  NOT NULL,
  "distance_along_shape_m" INT,
  CONSTRAINT "route_stops_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "route_stops_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "route_stops_stop_id_fkey" FOREIGN KEY ("stop_id") REFERENCES "stops"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "route_stops_route_id_direction_sequence_key" ON "route_stops"("route_id", "direction", "sequence");
CREATE INDEX "route_stops_stop_id_idx" ON "route_stops"("stop_id");

-- schedule_entries
CREATE TABLE "schedule_entries" (
  "id"                              UUID        NOT NULL DEFAULT gen_random_uuid(),
  "route_id"                        UUID        NOT NULL,
  "stop_id"                         UUID        NOT NULL,
  "direction"                       "Direction" NOT NULL,
  "days_of_week"                    INT         NOT NULL,
  "departure_seconds_from_midnight" INT         NOT NULL,
  CONSTRAINT "schedule_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "schedule_entries_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "schedule_entries_stop_id_fkey" FOREIGN KEY ("stop_id") REFERENCES "stops"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "schedule_entries_stop_id_days_dep_idx" ON "schedule_entries"("stop_id", "days_of_week", "departure_seconds_from_midnight");
CREATE INDEX "schedule_entries_route_id_idx" ON "schedule_entries"("route_id");

-- import_runs (audit trail for daily refresh job)
CREATE TABLE "import_runs" (
  "id"          UUID           NOT NULL DEFAULT gen_random_uuid(),
  "operator_id" UUID           NOT NULL,
  "source_url"  TEXT,
  "status"      VARCHAR(40)    NOT NULL,
  "stats"       JSONB,
  "error"       TEXT,
  "started_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMPTZ(6),
  CONSTRAINT "import_runs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "import_runs_operator_id_started_at_idx" ON "import_runs"("operator_id", "started_at");

-- Seed the two MVP cities so importers can FK to them on first run.
INSERT INTO "cities" ("id", "code", "name", "timezone", "updated_at")
VALUES
  (gen_random_uuid(), 'IST', 'İstanbul', 'Europe/Istanbul', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'ANK', 'Ankara',   'Europe/Istanbul', CURRENT_TIMESTAMP);
