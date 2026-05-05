-- Phase 3: real-time vehicle position history (TimescaleDB hypertable).
-- Note: TimescaleDB extension assumed; if running on stock Postgres in dev,
-- the create_hypertable call below is wrapped in DO/EXCEPTION so the table is
-- usable even without Timescale.

CREATE TABLE "vehicle_positions" (
  "time"          TIMESTAMPTZ      NOT NULL,
  "vehicle_id"    VARCHAR(120)     NOT NULL,
  "route_id"      UUID,
  "operator_id"   UUID             NOT NULL,
  "lat"           DOUBLE PRECISION NOT NULL,
  "lng"           DOUBLE PRECISION NOT NULL,
  "speed_kmh"     REAL             NOT NULL DEFAULT 0,
  "heading"       REAL             NOT NULL DEFAULT 0,
  "source_lag_ms" INT              NOT NULL DEFAULT 0
);
CREATE INDEX "vehicle_positions_route_time_idx" ON "vehicle_positions"("route_id", "time" DESC);
CREATE INDEX "vehicle_positions_vehicle_time_idx" ON "vehicle_positions"("vehicle_id", "time" DESC);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
    PERFORM create_hypertable('vehicle_positions', 'time', if_not_exists => TRUE);
    PERFORM add_retention_policy('vehicle_positions', INTERVAL '30 days');
  END IF;
END$$;
