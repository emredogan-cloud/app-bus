-- Phase 1: auth + KVKK.
-- Replaces the Phase 0 placeholder. (Phase 0 had been merely an empty users table.)

CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Enums
CREATE TYPE "Locale"        AS ENUM ('tr', 'en');
CREATE TYPE "PremiumTier"   AS ENUM ('free', 'premium');
CREATE TYPE "OAuthProvider" AS ENUM ('google', 'apple');
CREATE TYPE "DeleteStatus"  AS ENUM ('active', 'pending_purge', 'purged');

-- users
CREATE TABLE "users" (
  "id"              UUID           NOT NULL DEFAULT gen_random_uuid(),
  "email"           CITEXT         NOT NULL,
  "email_verified"  BOOLEAN        NOT NULL DEFAULT false,
  "password_hash"   TEXT,
  "name"            VARCHAR(120)   NOT NULL,
  "locale"          "Locale"       NOT NULL DEFAULT 'tr',
  "phone_e164"      VARCHAR(20),
  "premium_tier"    "PremiumTier"  NOT NULL DEFAULT 'free',
  "delete_status"   "DeleteStatus" NOT NULL DEFAULT 'active',
  "delete_purge_at" TIMESTAMPTZ(6),
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_delete_status_delete_purge_at_idx" ON "users"("delete_status", "delete_purge_at");

-- refresh_tokens
CREATE TABLE "refresh_tokens" (
  "id"          UUID           NOT NULL DEFAULT gen_random_uuid(),
  "user_id"     UUID           NOT NULL,
  "family_id"   UUID           NOT NULL,
  "token_hash"  TEXT           NOT NULL,
  "rotated_at"  TIMESTAMPTZ(6),
  "revoked_at"  TIMESTAMPTZ(6),
  "expires_at"  TIMESTAMPTZ(6) NOT NULL,
  "user_agent"  VARCHAR(255),
  "ip"          INET,
  "created_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "refresh_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- oauth_identities
CREATE TABLE "oauth_identities" (
  "id"               UUID            NOT NULL DEFAULT gen_random_uuid(),
  "user_id"          UUID            NOT NULL,
  "provider"         "OAuthProvider" NOT NULL,
  "provider_user_id" VARCHAR(255)    NOT NULL,
  "email"            CITEXT,
  "created_at"       TIMESTAMPTZ(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "oauth_identities_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "oauth_identities_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "oauth_identities_provider_provider_user_id_key" ON "oauth_identities"("provider", "provider_user_id");
CREATE INDEX "oauth_identities_user_id_idx" ON "oauth_identities"("user_id");

-- kvkk_consents (immutable: history of every accept)
CREATE TABLE "kvkk_consents" (
  "id"               UUID           NOT NULL DEFAULT gen_random_uuid(),
  "user_id"          UUID           NOT NULL,
  "version"          VARCHAR(32)    NOT NULL,
  "marketing_opt_in" BOOLEAN        NOT NULL DEFAULT false,
  "ip"               INET,
  "user_agent"       VARCHAR(255),
  "accepted_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "kvkk_consents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "kvkk_consents_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "kvkk_consents_user_id_version_idx" ON "kvkk_consents"("user_id", "version");

-- email_verification_tokens
CREATE TABLE "email_verification_tokens" (
  "id"         UUID           NOT NULL DEFAULT gen_random_uuid(),
  "user_id"    UUID           NOT NULL,
  "token_hash" TEXT           NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "used_at"    TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "email_verification_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "email_verification_tokens_token_hash_key" ON "email_verification_tokens"("token_hash");
CREATE INDEX "email_verification_tokens_user_id_idx" ON "email_verification_tokens"("user_id");

-- password_reset_tokens
CREATE TABLE "password_reset_tokens" (
  "id"         UUID           NOT NULL DEFAULT gen_random_uuid(),
  "user_id"    UUID           NOT NULL,
  "token_hash" TEXT           NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "used_at"    TIMESTAMPTZ(6),
  "ip"         INET,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "password_reset_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");
