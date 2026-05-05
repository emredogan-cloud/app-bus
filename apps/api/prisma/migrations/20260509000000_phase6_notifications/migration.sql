-- Phase 6: favorites + notifications.

CREATE TYPE "FavoriteTarget"     AS ENUM ('stop', 'route');
CREATE TYPE "DevicePlatform"     AS ENUM ('ios', 'android', 'web');
CREATE TYPE "NotificationStatus" AS ENUM ('queued', 'sent', 'failed', 'skipped');

CREATE TABLE "user_favorites" (
  "id"          UUID             NOT NULL DEFAULT gen_random_uuid(),
  "user_id"     UUID             NOT NULL,
  "target_type" "FavoriteTarget" NOT NULL,
  "target_id"   UUID             NOT NULL,
  "label"       VARCHAR(120),
  "sort_order"  INT              NOT NULL DEFAULT 0,
  "created_at"  TIMESTAMPTZ(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_favorites_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "user_favorites_user_id_target_type_target_id_key" ON "user_favorites"("user_id", "target_type", "target_id");
CREATE INDEX "user_favorites_user_id_sort_order_idx" ON "user_favorites"("user_id", "sort_order");

CREATE TABLE "notification_rules" (
  "id"                    UUID           NOT NULL DEFAULT gen_random_uuid(),
  "user_id"               UUID           NOT NULL,
  "stop_id"               UUID           NOT NULL,
  "route_id"              UUID,
  "threshold_minutes"     INT            NOT NULL,
  "days_of_week_bitmask"  INT            NOT NULL DEFAULT 127,
  "quiet_hours_start_min" INT,
  "quiet_hours_end_min"   INT,
  "enabled"               BOOLEAN        NOT NULL DEFAULT true,
  "created_at"            TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"            TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "notification_rules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "notification_rules_user_id_enabled_idx" ON "notification_rules"("user_id", "enabled");
CREATE INDEX "notification_rules_stop_id_idx" ON "notification_rules"("stop_id");

CREATE TABLE "notification_logs" (
  "id"              UUID                 NOT NULL DEFAULT gen_random_uuid(),
  "user_id"         UUID                 NOT NULL,
  "rule_id"         UUID                 NOT NULL,
  "eta_unix"        INT                  NOT NULL,
  "sent_at"         TIMESTAMPTZ(6),
  "status"          "NotificationStatus" NOT NULL,
  "expo_receipt_id" VARCHAR(120),
  "idempotency_key" TEXT                 NOT NULL,
  "created_at"      TIMESTAMPTZ(6)       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "notification_logs_idempotency_key_key" ON "notification_logs"("idempotency_key");
CREATE INDEX "notification_logs_user_id_sent_at_idx" ON "notification_logs"("user_id", "sent_at");

CREATE TABLE "device_tokens" (
  "id"               UUID             NOT NULL DEFAULT gen_random_uuid(),
  "user_id"          UUID             NOT NULL,
  "expo_push_token"  TEXT             NOT NULL,
  "platform"         "DevicePlatform" NOT NULL,
  "last_seen_at"     TIMESTAMPTZ(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at"       TIMESTAMPTZ(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "device_tokens_expo_push_token_key" ON "device_tokens"("expo_push_token");
CREATE INDEX "device_tokens_user_id_idx" ON "device_tokens"("user_id");
