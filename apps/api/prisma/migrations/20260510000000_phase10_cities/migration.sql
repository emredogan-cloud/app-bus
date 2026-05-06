-- Phase 10 part 1/2: widen the CityCode enum.
-- Postgres forbids using a freshly-added enum value in the same transaction
-- it was added in, so the corresponding INSERTs live in a follow-up migration
-- (20260510000100_phase10_cities_seed).

ALTER TYPE "CityCode" ADD VALUE IF NOT EXISTS 'IZM';
ALTER TYPE "CityCode" ADD VALUE IF NOT EXISTS 'BUR';
ALTER TYPE "CityCode" ADD VALUE IF NOT EXISTS 'ANT';
