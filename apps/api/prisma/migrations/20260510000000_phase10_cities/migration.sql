-- Phase 10: widen CityCode enum + seed three new cities (IZM, BUR, ANT).

ALTER TYPE "CityCode" ADD VALUE IF NOT EXISTS 'IZM';
ALTER TYPE "CityCode" ADD VALUE IF NOT EXISTS 'BUR';
ALTER TYPE "CityCode" ADD VALUE IF NOT EXISTS 'ANT';

-- Seed cities (idempotent on code unique index)
INSERT INTO "cities" ("id", "code", "name", "timezone", "updated_at") VALUES
  (gen_random_uuid(), 'IZM', 'İzmir',  'Europe/Istanbul', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'BUR', 'Bursa',  'Europe/Istanbul', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'ANT', 'Antalya','Europe/Istanbul', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
