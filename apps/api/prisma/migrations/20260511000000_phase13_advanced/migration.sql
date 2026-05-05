-- Phase 13: advanced features.

-- Crowd reports — users tag stops/vehicles as crowded. Abuse prevention via
-- a unique (user, target, day) constraint plus rate-limit at the controller.
CREATE TYPE "CrowdLevel" AS ENUM ('empty', 'normal', 'busy', 'full');

CREATE TABLE "crowd_reports" (
  "id"          UUID           NOT NULL DEFAULT gen_random_uuid(),
  "user_id"     UUID           NOT NULL,
  "target_type" "FavoriteTarget" NOT NULL, -- reuses 'stop' / 'route'
  "target_id"   UUID           NOT NULL,
  "level"       "CrowdLevel"   NOT NULL,
  "created_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "crowd_reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "crowd_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX "crowd_reports_target_created_idx" ON "crowd_reports"("target_type", "target_id", "created_at" DESC);
-- one report per (user, target) per UTC day to deter spam
CREATE UNIQUE INDEX "crowd_reports_user_target_day_idx"
  ON "crowd_reports"("user_id", "target_type", "target_id", (date_trunc('day', "created_at")));

-- B2B API keys
CREATE TABLE "api_keys" (
  "id"          UUID           NOT NULL DEFAULT gen_random_uuid(),
  "user_id"     UUID,
  "name"        VARCHAR(120)   NOT NULL,
  -- sha256 of the secret. The client receives `<id>.<secret>` once at issuance.
  "key_hash"    TEXT           NOT NULL,
  -- Scope is a CSV of permissions ("read:stops,read:etas")
  "scopes"      TEXT           NOT NULL DEFAULT 'read:public',
  "rate_limit_per_min" INT     NOT NULL DEFAULT 600,
  "active"      BOOLEAN        NOT NULL DEFAULT true,
  "expires_at"  TIMESTAMPTZ(6),
  "last_used_at" TIMESTAMPTZ(6),
  "created_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");
CREATE INDEX "api_keys_user_active_idx" ON "api_keys"("user_id", "active");

-- Referrals
CREATE TABLE "referrals" (
  "id"          UUID           NOT NULL DEFAULT gen_random_uuid(),
  "code"        VARCHAR(40)    NOT NULL,
  "owner_user_id" UUID         NOT NULL,
  "redeemed_by_user_id" UUID,
  "redeemed_at" TIMESTAMPTZ(6),
  "created_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "referrals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "referrals_owner_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "referrals_redeemer_fkey" FOREIGN KEY ("redeemed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX "referrals_code_key" ON "referrals"("code");
CREATE INDEX "referrals_owner_idx" ON "referrals"("owner_user_id");
