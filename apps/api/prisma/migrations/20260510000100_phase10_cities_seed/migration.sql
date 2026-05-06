-- Phase 10 part 2/2: seed cities IZM/BUR/ANT, idempotent on the code unique index.
-- Runs in a separate transaction from the ALTER TYPE so Postgres lets us reference
-- the new enum values.

INSERT INTO "cities" ("id", "code", "name", "timezone", "updated_at") VALUES
  (gen_random_uuid(), 'IZM', 'İzmir',  'Europe/Istanbul', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'BUR', 'Bursa',  'Europe/Istanbul', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'ANT', 'Antalya','Europe/Istanbul', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
