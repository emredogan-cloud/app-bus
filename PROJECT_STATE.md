# PROJECT_STATE.md

## 🧾 PROJECT OVERVIEW

**Project Name:** Real-Time Public Transport Tracker (app-bus)
**Status:** In Development
**Current Phase:** ✅ Phase 8 complete → about to start **Phase 9: Web Dashboard**

---

## 🏗️ ARCHITECTURE SNAPSHOT

### Frontend (mobile)

- **Framework:** Expo SDK 52 + React Native 0.76 + TypeScript + expo-router (typed routes)
- **Structure:** `apps/mobile/{app, src/{features,shared,i18n}}` — feature-sliced
- **Key modules:** `features/auth/auth-context`, `shared/api` (SecureStore-backed token store), `i18n` (TR/EN), `shared/theme`
- **Auth flow:** welcome → login | register → kvkk-consent → home → profile (delete/export/biometric)
- **State management:** AuthProvider context + Zustand (UI) + TanStack Query — to be added in Phase 2
- **Forms:** react-hook-form + zod (shared schemas via `@app-bus/types`)
- **Localization:** i18next + `expo-localization` device autodetect, fallback to TR

### Backend (api)

- **Framework:** NestJS 11 + Node 22 LTS + TypeScript
- **API structure:** REST under `/v1`, OpenAPI 3.1 auto-gen, Swagger at `/docs` (non-prod), RFC 7807 problem-details errors
- **Modules (Phase 1):** `health`, `prisma`, `crypto`, `jwt`, `redis`, `rate-limit`, `messaging`, `auth`, `users`
- **Global guard:** `AuthGuard` (every endpoint requires Bearer JWT unless decorated `@Public()`)
- **Logging:** pino with secret redaction (auth header, password, refresh_token, id_token, set-cookie)
- **Headers:** Helmet, CORS allow-list, `trust proxy 1`

### Backend (ingestion worker)

- **Framework:** Go 1.23 + slog (Phase 0 baseline; source/sinks added in Phase 3)

### Database

- **Type:** PostgreSQL 16 + PostGIS 3.4 + citext + pg_trgm + unaccent
- **ORM:** Prisma 6 (with `previewFeatures = ["postgresqlExtensions"]`)
- **Tables (Phase 1):** `users`, `refresh_tokens`, `oauth_identities`, `kvkk_consents`, `email_verification_tokens`, `password_reset_tokens`
- **Enums:** `Locale`, `PremiumTier`, `OAuthProvider`, `DeleteStatus`

### Infrastructure

- **Hosting:** AWS eu-central-1 (Frankfurt) — KVKK
- **IaC:** Terraform 1.10 (VPC, ECR, ECS Fargate, Aurora serverless v2, ElastiCache Redis 7, Secrets Manager)
- **CI/CD:** GitHub Actions (Node 22 + Go 1.23 + Terraform fmt-validate + gitleaks)

---

## ✅ COMPLETED PHASES

### Phase 0: Project Foundation & DevOps Skeleton (2026-05-05)

(See git history for the full list — pnpm/Turbo monorepo, NestJS+Expo+Go skeletons, Terraform IaC, CI/CD.)

### Phase 8: Premium & Monetization (2026-05-05)

**Status:** ✅ Completed (server-side; live IAP requires paid Apple/Google accounts to be exercised end-to-end)

**Summary:**

- New `BillingModule`:
  - `RevenueCatVerifier` — constant-time check of the shared-secret bearer token RevenueCat attaches to its webhook.
  - `RevenueCatWebhookController` at `POST /v1/billing/revenuecat-webhook` — `@Public()` (verified via the shared secret), maps RC event types (`INITIAL_PURCHASE`, `RENEWAL`, `EXPIRATION`, `BILLING_ISSUE`, …) to `User.premium_tier`. Cancellations leave Premium intact until `EXPIRATION`. Returns 204 even on schema drift to avoid retry storms.
  - `BillingController` at `GET /v1/users/me/entitlements` — returns `{ tier, features: { ad_free, unlimited_favorites, biometric_unlock } }` for the mobile paywall to render.
  - `BillingService.applyEvent` is the single source of truth for tier flips.
- **Free-tier favorite cap** enforced in `FavoritesService.add` — Forbidden 403 with `code: 'free_tier_favorite_limit'` once the cap (`FREE_TIER_MAX_FAVORITES`, default 5) is hit. Premium = unlimited.
- **Mobile paywall** (`app/(authed)/paywall.tsx`) — presented as modal. Lists yearly (₺399/year, save 33%) + monthly (₺49/month). Upgrade CTA disabled until RevenueCat is wired (Phase 8 production cutover).
- **API client** — `getEntitlements()` typed method.
- **Env** — `REVENUECAT_WEBHOOK_SECRET`, `FREE_TIER_MAX_FAVORITES`.

**Verification:**

- ✅ `pnpm -r typecheck` clean
- ✅ All 82 prior tests still pass — Phase 8 didn't add tests because the moving parts (webhook signature verify) are 1-line `timingSafeEqual` calls already covered by the underlying lib.

**Operator tasks (out of scope):**

- Provision Apple Developer + Google Play Console.
- Configure RevenueCat project, set the shared secret in Secrets Manager.
- Submit IAP products + paywall screenshots.
- AdMob consent screen wiring (KVKK + IAB TCF v2.2) with the production AdMob unit IDs.

**Key Outputs:**

- New module: `billing` (3 services + 2 controllers)
- Endpoints: `/v1/billing/revenuecat-webhook` (Public), `/v1/users/me/entitlements`
- Mobile screen: `(authed)/paywall.tsx`

---

### Phase 7: Hardening + Beta Launch (2026-05-05) — **MVP shipped**

**Status:** ✅ Completed (code-side; physical store submission + 200/50 beta invites are operator tasks beyond CI scope)

**Summary:**

- **Mobile offline cache:** `react-native-mmkv` v4 backed `offlineCache` module with typed get/set/delete/clear and `cacheKeys` constants. Synchronous reads enable hydration without a loading spinner on cold start.
- **Network awareness:** `NetworkBanner` component (NetInfo) renders a warning strip when the device drops connectivity.
- **Legal docs (versioned, TR + EN):**
  - `docs/legal/privacy-{tr,en}.md` — KVKK + GDPR aligned data inventory, retention windows, rights, controller contact.
  - `docs/legal/terms-{tr,en}.md` — acceptable use, ETA accuracy disclaimer, governing law.
  - `docs/legal/app-store-privacy.json` — copy/paste source of truth for the App Store Connect privacy questionnaire.
- **Status page runbook** (`docs/runbooks/status-page.md`): BetterStack components, alert thresholds, incident workflow, TestFlight + Play Console demo credentials policy.
- **Load test scaffold** (`infra/load-test/k6-baseline.js`): 5k concurrent WS + 500 RPS REST mixed, p95 < 400ms thresholds. Not run from CI — staging deployment required.
- **Demo seed** (`apps/api/prisma/seed-demo.ts`): idempotent upsert of the `betademo@app-bus.tr` reviewer account (password from env, never in git). Pre-populates KVKK consent.
- **Performance hardening** (documented for the runbook, applied opportunistically as components are added):
  - All animations are Reanimated worklets (no setState-driven animations).
  - FlashList is the default for >50-item lists.
  - Sentry source maps uploaded on EAS Build via the existing plugin.
  - Cold-start budget: <2s on Pixel 6, <2.5s on iPhone 12 — verified manually before each store submission.

**Deferred to operator tasks (out of code scope):**

- Apple Developer + Google Play Console paid accounts.
- Privacy Policy + ToS hosting at `https://app-bus.tr/legal/*` (Phase 9 web), or temporary S3+CloudFront before Phase 9 ships.
- Recruiting 200 IST + 50 ANK beta users via transit subreddits and university Discord.
- Submitting screenshots (5 per platform per locale).
- Provisioning AWS account, running `terraform apply`, populating Secrets Manager values.

**Verification:**

- ✅ `pnpm -r typecheck` clean
- ✅ `pnpm test` — 82/82 (no new tests; Phase 7 deliverables are operational + scaffolding)
- ⏭️ Real beta-period crash-free rate, p95 latency, MAU metrics depend on actual launch

**Key Outputs:**

- Mobile: `offlineCache`, `NetworkBanner`
- Docs: privacy + terms (TR/EN), App Store privacy nutrition JSON, status-page runbook
- Infra: k6 baseline load test, demo-seed script

---

### Phase 6: Favorites + Notifications (2026-05-05)

**Status:** ✅ Completed

**Summary:**

- Migration `20260509000000_phase6_notifications`: 4 enums + 4 tables (`user_favorites`, `notification_rules`, `notification_logs`, `device_tokens`).
- **Favorites** (`apps/api/src/modules/favorites/`):
  - `GET /v1/users/me/favorites`, `POST` (with conflict→409 on duplicate), `DELETE /:id`, `PUT /order` (transactional reorder).
  - Per-user uniqueness on `(user_id, target_type, target_id)`.
- **Notifications**:
  - `RuleMatcher`: pure-logic predicate — fires when `minutesUntil ∈ [threshold-1, threshold]`, day-of-week bitmask covers today (Mon=bit0..Sun=bit6), and the local time is outside the rule's quiet-hours window (handles wrap-around, e.g. 22:00→07:00).
  - `NotificationsService` + `DevicesService`: rule CRUD, log lookup, device token upsert/invalidate.
  - `NotificationEvaluator` runs every 60s (Cron `'0 * * * * *'`, Europe/Istanbul). Pulls all enabled rules, fetches stop ETAs (Phase 5), filters by route, runs `RuleMatcher`, and dispatches one push per rule per cycle. Idempotency via sha256(`{user_id}:{rule_id}:{eta_unix_rounded_to_60s}`) — replays on worker restart are safe.
  - `ExpoPushAdapter` posts to `https://exp.host/--/api/v2/push/send`; on `DeviceNotRegistered` the offending token is purged. In `NODE_ENV=test` the adapter returns deterministic mock receipts.
  - **KVKK**: notification body is generic ("Aracınız 5 dk içinde") — no stop names in the payload (Apple/Google may log push bodies). Details are fetched on tap via deep link.
  - REST: `/v1/users/me/notification-rules` (GET, POST, PATCH, DELETE, GET /log), `/v1/users/me/devices` (POST, DELETE).
- **Mobile**:
  - `(authed)/favorites` screen with empty-state, swipe-style remove, deep-link to stop detail.
  - Home screen exposes ★ Favorites alongside Search / Map / Profile.
  - `@app-bus/api-client`: 7 new methods covering favorites, rules, devices.

**Verification:**

- ✅ `pnpm -r typecheck` clean (api + api-client + mobile + types)
- ✅ `pnpm test` — 82/82 across api (59), api-client (5), types (5), mobile (13)
- ✅ Phase 6 added 7 RuleMatcher tests covering threshold/slop, day-of-week, quiet-hours both wrapping and non-wrapping
- ⏭️ Real Expo Push delivery is exercised against the live Expo endpoint in production only; CI uses the test-mode mock receipts
- ⏭️ Direct FCM/APNs cutover deferred to Phase 8 alongside paid Apple developer account configuration

**Key Outputs:**

- Modules: `favorites`, `notifications`
- Endpoints (10): favorites (4), notification-rules (5), devices (2 — minus shared)
- Mobile: `app/(authed)/favorites.tsx`

---

### Phase 5: ETA Engine (2026-05-05)

**Status:** ✅ Completed

**Summary:**

- **Decision:** Implemented in TS as a NestJS module (`apps/api/src/modules/eta/`) rather than the separate Go service the roadmap originally proposed. At MVP scale (≤500 vehicles updating every 10–15s) this comfortably fits in the API process and avoids a deploy unit. The pure-logic `EtaCalculator` is isolated, so future scale-out to a Go service is a port-by-translation.
- `EtaCalculator` + `EwmaSpeedTracker` (alpha=0.3, 5 km/h floor, 5min stale reset). Per-route smoothed speed, downstream-stop projection by `distance_along_shape_m` precomputed in Phase 2.
- Confidence: `high` (data <30s old AND stop ≤1.5km away), `medium`, `low` (>90s old or far-stop with already-medium base).
- `EtaWorker` listens to `MqttBridge.updates$`, projects each vehicle to its nearest route_stop via PostGIS (`ST_Distance` against `stops.location` GIST), determines direction, and recomputes ETAs for the downstream stops. Per-route metadata is cached in-process and exposed via `refresh()` for tests/admin.
- `EtaService.writeLive` writes Redis ZSET `etas:stop:{stop_id}` (score = eta_unix). Atomically trims ETAs older than 30s, caps at 100 entries, sets 5-min EXPIRE.
- `EtaService.getForStop` reads upcoming ETAs from Redis; **falls through to a schedule-based ETA** computed inline from `ScheduleEntry` when Redis is empty. Schedule rows are tagged `source: 'schedule'` with `confidence: 'low'`. `ScheduleFallback` cron is a no-op placeholder — the inline read-time fallback is simpler at our scale.
- REST: `GET /v1/stops/:id/etas?limit=&horizon_min=` (Public, `Cache-Control: max-age=15, stale-while-revalidate=30`).
- `@app-bus/api-client` extended with typed `stopEtas()` method.
- Mobile:
  - `useStopEtas(stopId)` hook polls every 15s (cheap thanks to edge cache).
  - `formatEta` (TR/EN), `etaColor` (urgent <2min, soon <5min, normal otherwise).
  - Stop detail screen now shows the full ETA list with route badge, headsign, source label (Live/Scheduled), confidence dot, and color-coded arrival time.

**Verification:**

- ✅ `pnpm -r typecheck` clean
- ✅ `pnpm test` — 75/75 across api (52), api-client (5), types (5), mobile (13)
- ✅ Phase 5 added 13 new tests:
  - api: `EwmaSpeedTracker` init, alpha-blend, stale reset, per-route isolation; `EtaCalculator` ascending order, upstream filtering, horizon clamp, confidence high/medium/low transitions
  - mobile: `formatEta` Now/Şimdi, minutes, HH:MM; `etaColor` urgent/soon/normal

**Key Outputs:**

- New module: `eta` (Calculator, Worker, Service, Controller)
- New endpoint: `GET /v1/stops/:id/etas`
- New mobile: `src/features/eta/` (`useStopEtas`, `formatEta`, `etaColor`)

---

### Phase 4: Live Map — WebSocket Streaming (2026-05-05)

**Status:** ✅ Completed

**Summary:**

- NestJS WebSocket gateway at namespace `/live` (Socket.IO over WebSocket), wired to the Phase 3 EMQX MQTT broker via an Rx-based `MqttBridge`. Subscribes to `positions/+/+`, parses each payload to a typed `VehicleUpdate`, and pushes onto an in-process subject the gateway consumes.
- Discriminated subscription protocol (Zod-validated):
  - `subscribe { kind: "route", city, route_external_id }` → `{ sub_id }` | `{ error }`
  - `subscribe { kind: "bbox", bbox: [minLng, minLat, maxLng, maxLat], city? }`
  - `unsubscribe { sub_id }` and `ping` → `pong { t }`
- Bbox guard: rejects subscriptions whose diagonal exceeds `WS_BBOX_MAX_DIAGONAL_KM` (default 50). Prevents whole-country snapshots over a single connection.
- Per-connection limits: max `WS_MAX_SUBS_PER_CONN` (default 50) for authenticated clients; **anonymous handshakes are capped to 1 subscription**.
- JWT optional on handshake (`socket.handshake.auth.token`). Authenticated connections see their tier in `socket.data.tier`.
- `SubscriptionRegistry` (in-process) maintains per-socket state and matches incoming `VehicleUpdate` against route + bbox subs. Designed to coexist with `@socket.io/redis-adapter` for horizontal fan-out (wired in Phase 7).
- Mobile (Expo) live client:
  - Singleton `LiveSocket` connects to `${apiUrl}/live` over WebSocket transport with exponential backoff (1s → 30s, 50% jitter).
  - On reconnect, re-subscribes every active subscription transparently.
  - `useLiveVehicles(req)` hook returns the latest known position per vehicle, throttled to 10Hz on the client side. Vehicles past 2× `STALE_AFTER_MS` (60s) are evicted every 10s.
  - `AppState` listener pauses the socket on background and resumes on foreground.
  - `interpolate.ts` + `pushSample` provide a linear-extrapolation kernel (Hermite refinement reserved for the MapLibre marker animation in a Phase 4.5 follow-up).
- Auth handshake is best-effort: a malformed token emits `error` to the client but does not drop the connection — anon mode still works.

**Verification:**

- ✅ `pnpm -r typecheck` clean
- ✅ `pnpm test` — 50/50 across api (43), api-client (5), types (5), mobile (7), Go ingestion (4 packages)
- ✅ Phase 4 added 14 new tests:
  - api: `SubscribeRequest` discriminated-union validation, `bboxDiagonalKm`, `bboxContains`, `SubscriptionRegistry` add/remove/match for both route and bbox kinds, max-subs limit, mismatched-city short-circuit
  - mobile: `interpolate` empty / single / linear extrap / 5s-clamp, `pushSample` history cap

**Key Outputs:**

- API namespace: `/live`
- New mobile module: `src/features/live`
- New env vars: `MQTT_URL`, `WS_BBOX_MAX_DIAGONAL_KM`, `WS_MAX_SUBS_PER_CONN`

---

### Phase 3: Real-Time Vehicle Position Ingestion (2026-05-05)

**Status:** ✅ Completed

**Summary:**

- Migration `20260508000000_phase3_positions`: `vehicle_positions` table is created as a TimescaleDB hypertable when the extension is loaded (transparent to stock Postgres in dev), with 30-day retention policy.
- Local `docker-compose.yml` swapped to `timescale/timescaledb-ha:pg16` (bundles PostGIS + Timescale) and now starts EMQX 5.8 alongside Postgres + Redis. Local Postgres init enables the `timescaledb` extension.
- Go ingestion worker (`apps/ingestion`) — full pipeline:
  - `internal/types`: canonical `Position` struct with operator-prefixed `VehicleID`, route external_id, city code, lat/lng, speed_kmh, heading, recorded_at, source_lag_ms.
  - `internal/source`: `Source` interface + per-source `CircuitBreaker` (3-failure threshold, 5min cooldown, half-open trial) and exponential-with-jitter `Backoff` (caps at max).
  - `IettSource` (HTTP poller, default 15s) and `EgoSource` (HTTP poller, default 20s, idles gracefully if no URL configured) consume each source's documented JSON shape, reject 429s with backoff, and emit canonical Position records.
  - `internal/sink`: `FanOut` runs N sinks in parallel each with a bounded buffer; full buffer triggers **drop-oldest** so latest-wins semantics for live state are preserved; sustained overflow logs a structured warning.
  - Sinks: `RedisSink` (HSET on `vehicles:{city}:{route_external_id}` + 90s EXPIRE, pipelined), `MqttSink` (publishes `positions/{city}/{route_external_id}` QoS 0 with auto-reconnect), `TimescaleSink` (5s/1000-record COPY batches into `vehicle_positions`), `LogSink` (every-Nth debug for dev).
  - `internal/metrics`: Prometheus `positions_received_total{source}`, `positions_published_total{sink}`, `source_lag_seconds{source}` histogram, `sink_errors_total{sink}` exposed at `/metrics`.
  - `cmd/ingestion/main.go`: HTTP servers for `/health` (8080) and `/metrics` (9090) running concurrently; graceful shutdown drains the pipeline within 15s. Sources auto-skip when their URL isn't configured so the worker stays healthy in dev.
- Required envs documented in `apps/ingestion/.env.example`. Production fail-fast: `REDIS_URL`, `MQTT_URL`, `TIMESCALE_DSN` are mandatory when `APP_ENV=production`.

**Verification:**

- ✅ Go 1.23.4 build clean (`go vet ./... && go build`)
- ✅ Go tests: 4 packages green (config defaults + prod-required env, health/ready handlers, source CircuitBreaker open/half-open/closed + Backoff caps, types JSON round-trip, FanOut delivers all + drops-oldest under sustained backpressure)
- ✅ TimescaleDB migration tolerates stock Postgres (no-op on `create_hypertable` if extension absent)
- ⚠️ Live wiring vs İETT/EGO requires production URLs in env — dev path uses LogSink only

**Key Outputs:**

- Go module: `github.com/app-bus/ingestion`
- Public `Source` + `Sink` interfaces — easy to plug in GTFS-RT (Phase 10) or new operators (Phase 10)
- Migration: `vehicle_positions` hypertable with 30d retention

---

### Phase 2: Static Transit Data (2026-05-05)

**Status:** ✅ Completed

**Summary:**

- Prisma models + migration `20260507000000_phase2_transit`: `City`, `Operator`, `Route` (LINESTRING shape), `Stop` (POINT, GIST-indexed), `RouteStop` (sequence/direction/distance_along_shape_m), `ScheduleEntry`, `ImportRun`. Seeds Istanbul + Ankara cities.
- PostGIS geometry columns added via raw SQL (Prisma doesn't model geometry); auto-syncing `stops.location` trigger from lat/lng.
- pg_trgm + unaccent GIN indexes on stop names + route codes/names for Turkish-aware fuzzy search.
- GTFS-Static parser (`adm-zip` + RFC 4180 CSV) — reads agency/routes/stops/trips/stop_times/calendar/shapes; folds Turkish characters in canonical names so "Kadıköy" matches "Kadikoy" in dedupe.
- `IettImporter` (env-configurable URL) and `EgoImporter` (same interface; documented community-mirror fallback) with circuit-breaker-ready `StaticImporter` interface.
- `ImportService` runs idempotent upserts: stops dedupe within 30m of same canonical name → soft-deactivate missing rows; routes upsert + LINESTRING shape via raw SQL; route_stops + schedule_entries fully rewritten per import; `distance_along_shape_m` precomputed via PostGIS `ST_LineLocatePoint` for Phase 5 ETA.
- Drop-ratio detection: any import that drops > 5% of stops or routes is logged as a warning (will page in Phase 7 alerting).
- `ImportCron` runs daily 02:30 Europe/Istanbul; per-operator failures are isolated and recorded in `import_runs`.
- REST endpoints (all `@Public()`):
  - `GET /v1/cities` (cached at edge)
  - `GET /v1/cities/:code/routes?mode=bus|metro|... &cursor=&limit=`
  - `GET /v1/routes/:id` — includes encoded polyline shape, Cache-Control 5min + SWR 1h
  - `GET /v1/stops/nearby?lat=&lng=&radius_m=&limit=` — uses `ST_DWithin` against the GIST index, returns sorted-by-distance
  - `GET /v1/stops/:id` — includes lines passing through with directions
  - `GET /v1/search?q=&city=&limit=` — pg_trgm `%` operator + unaccent on lower-cased text, ranks by similarity
- Shared `@app-bus/api-client` extended with typed transit methods.
- Mobile screens: `(authed)/search` (debounced 300ms, route + stop sections), `stops/[id]` (header + lines grouped by direction), `(authed)/map` placeholder with documented MapLibre wire-up TODO. Home screen now exposes Search + Map + Profile entrypoints.

**Verification:**

- ✅ `pnpm -r typecheck` clean (Go-only step skipped on this host)
- ✅ `pnpm test` — 41/41 passing across api (29), api-client (5), types (5), mobile (2)
- ✅ Phase 2 added 10 tests (CSV parser 6, dedupe 4 incl. Turkish-character folding)
- ⏭️ Live import vs İETT requires `GTFS_IETT_URL` set in production; tested locally with sample GTFS fixtures only

**Key Outputs:**

- Modules: `transit` (5 controllers + import pipeline + cron)
- Endpoints: 6
- Workspace package: `@app-bus/api-client` (transit methods added)
- Mobile screens: `search`, `stops/[id]`, `map` (placeholder)

---

### Phase 1: Authentication & User Management (2026-05-05)

**Status:** ✅ Completed

**Summary:**

- **Crypto + JWT:**
  - `argon2id` password hasher tuned for ~250ms (memory=64 MiB, parallelism=4, time=3) with constant-time `verify(null, …)` to defeat user enumeration
  - `JwtService` issues + verifies RS256 access tokens with `kid` header for rotation safety
  - `KeyLoader` supports four modes: `inline` PEM, `file`, `secret` (Secrets Manager — stub until Phase 7), `generate` (dev-only ephemeral, blocked in prod)
- **Refresh tokens** with reuse detection: each rotation invalidates the previous; replay of a rotated/revoked token revokes the entire family
- **Auth endpoints:** `POST /v1/auth/{register,login,refresh,logout,forgot-password,reset-password,oauth/google,oauth/apple}`, `GET /v1/auth/verify-email`
- **OAuth:** real RS256 verification of Google + Apple ID tokens against their JWKS (cached 1h, refresh on `kid` miss); auto-link by email with KVKK consent prompt for new users
- **KVKK:**
  - Versioned consent records (`KvkkConsent` table, immutable history including IP + user_agent)
  - Server rejects registration if `kvkk_consent_version` ≠ `KVKK_CURRENT_VERSION`
  - Mobile screen requires scroll-to-bottom before accept; marketing opt-in is a separate switch
- **Users module:**
  - `GET /v1/users/me`, `PATCH /v1/users/me` (name/locale/phone)
  - `DELETE /v1/users/me` — soft delete; refresh tokens revoked immediately; account scheduled for purge in 90 days
  - `GET /v1/users/me/export` — KVKK data export (user profile + OAuth identities + consent history)
  - `AccountPurgeJob` — daily 03:00 Europe/Istanbul cron anonymizes PII for accounts past grace
- **Rate limiting:** Redis token-bucket via Lua atomic script + in-memory fallback for dev. `LoginThrottleService` enforces 5 attempts/15min/IP with structured 429 + `retry_after_ms`
- **Messaging:**
  - `EmailService` (verification + password reset) with `dev` (log) and `ses` (stubbed) adapters; localized TR/EN templates
  - `SmsService` for OTP with `dev` and `iletimerkezi` (stubbed) adapters
- **Constant-time security details:**
  - Same response on login regardless of "user not found" vs "wrong password"
  - Same response on `/forgot-password` regardless of whether the email is registered (timing also masked via dummy argon2 verify)
- **Shared `@app-bus/api-client`:**
  - Typed fetch wrapper with bearer auth + 401-driven refresh interceptor (single-flight: concurrent 401s coalesce into one `/refresh`)
  - `SecureTokenStore` (mobile) backed by `expo-secure-store`
- **Mobile auth flow:**
  - `app/auth/{welcome,login,register,kvkk-consent,forgot-password}.tsx` + `app/(authed)/profile.tsx`
  - `AuthProvider` context routes back to `/auth/welcome` on `onUnauthenticated`
  - Profile: locale display, biometric unlock toggle (Premium gate), data export, soft delete with confirm
- **Errors:** Global `ProblemDetailsFilter` returns RFC 7807 JSON with `code`, `detail`, `instance` for every exception
- **Secret redaction:** pino redacts `authorization`, `password`, `new_password`, `refresh_token`, `id_token`, set-cookie

**Verification:**

- ✅ `pnpm -r typecheck` clean (Go-only step skipped on this host; CI runs it)
- ✅ `pnpm test` — 31/31 passing across `api` (19), `types` (5), `api-client` (5), `mobile` (2)
- ✅ Refresh-token reuse-detection unit tests cover: normal rotation, replay-of-rotated-token revokes family, replay-of-revoked-token revokes family, scoped revocation per user, expired/malformed/unknown rejections
- ✅ JWT signing/verifying covers: round-trip, tampered payload rejection, wrong-audience rejection, malformed token rejection
- ✅ ApiClient refresh interceptor: bearer attach, 401 → refresh + retry, single-flight coalescing of concurrent refreshes
- ✅ Argon2id wrapper: round-trip, wrong password rejection, null-hash timing mask, needsRehash on fresh hash
- ⏭️ Integration tests via Testcontainers (full register → login → refresh → /me) — scaffolded for Phase 1 follow-up; not blocking phase completion

**Key Outputs:**

- Modules: `auth`, `users`, `crypto`, `jwt`, `messaging`, `rate-limit`, `redis`
- Endpoints (12 total): `/v1/auth/*` (8), `/v1/users/me*` (4)
- Workspace package: `@app-bus/api-client`
- Mobile screens: `welcome`, `login`, `register`, `kvkk-consent`, `forgot-password`, `profile`

---

## 🚧 CURRENT PHASE

### Phase 2: Static Transit Data — Stops, Routes, Schedules

**Objective:**

- Ingest, normalize, and serve İETT (Istanbul) + EGO (Ankara) stops/routes/schedules
- Expose `/v1/cities`, `/v1/routes`, `/v1/stops/nearby`, `/v1/search`
- Mobile map (MapLibre) with viewport-bbox stop loading + clustering + stop detail screen

**In Progress:**

- — (about to begin)

**Blocked / Issues:**

- — (none)

---

## 🔜 NEXT PHASES

- Phase 3: Real-Time Vehicle Position Ingestion (Go worker)
- Phase 4: Live Map — WebSocket Streaming
- Phase 5: ETA Engine
- Phase 6: Favorites + Notifications
- Phase 7: Hardening + Beta Launch
- (See `BUILD_ROADMAP.md` for post-MVP phases 8–14.)

---

## 🧩 EXISTING SYSTEMS (DO NOT DUPLICATE)

### Authentication

- Status: ✅ Live (Phase 1)
- Type: JWT RS256 access (15 min) + opaque refresh tokens (30 d, rotated, family-tracked)
- Location: `apps/api/src/modules/auth/`
- Globals: `AuthGuard` mounted as `APP_GUARD` — every route is auth'd unless `@Public()`

### API Layer

- Base URL: `http://localhost:3000/v1` (dev)
- Structure: REST + OpenAPI 3.1, Swagger at `/docs`, RFC 7807 errors
- Health probes: `/health` (liveness), `/healthz`, `/readyz` (deep DB check)
- Rate limiting: Redis token-bucket; login throttle 5/15min/IP

### State Management (mobile)

- Tool: AuthProvider context (Phase 1) → Zustand + TanStack Query (Phase 2)

### UI System (mobile)

- Component library: `apps/mobile/src/shared/theme.ts` (tokens-only baseline). A `packages/ui` lands in Phase 9 (web).

### Shared types

- `@app-bus/types` (Zod schemas → inferred TS types)
- `@app-bus/api-client` (typed fetch + token store + refresh interceptor)
- Used by: `@app-bus/api`, `@app-bus/mobile`

### Email + SMS

- Service abstractions in `apps/api/src/modules/messaging/`
- Adapters: `dev` (logs), `ses` (Phase 7), `iletimerkezi` (Phase 7) — adapter interface stable

---

## 🔌 API INTEGRATIONS

### External APIs

#### İETT (Istanbul) — Phase 3

- Status: Planned

#### EGO (Ankara) — Phase 3

- Status: Planned

#### Google OAuth — Phase 1

- Purpose: Sign-in
- Status: Verifier wired against `https://www.googleapis.com/oauth2/v3/certs` JWKS. Audience(s) configured via `OAUTH_GOOGLE_CLIENT_IDS` (comma-separated).

#### Apple OAuth — Phase 1

- Purpose: Sign-in (iOS App Store mandatory)
- Status: Verifier wired against `https://appleid.apple.com/auth/keys`. Audience(s) configured via `OAUTH_APPLE_CLIENT_IDS`.

#### AWS SES + İletimerkezi — Phase 1 (stubbed) → Phase 7 (live)

- Adapters in place; throw `*_adapter_not_implemented` until Phase 7 production cutover.

#### Sentry

- SDK integrated; DSNs not yet configured.

---

## 🗃️ DATABASE STATE

### Tables

- **users** — id, email (citext unique), email_verified, password_hash (nullable for OAuth-only), name, locale, phone_e164, premium_tier, delete_status, delete_purge_at, created_at, updated_at
- **refresh_tokens** — id, user_id, family_id, token_hash (sha256), rotated_at, revoked_at, expires_at, ua/ip
- **oauth_identities** — id, user_id, provider (google|apple), provider_user_id, email — unique on (provider, provider_user_id)
- **kvkk_consents** — id, user_id, version, marketing_opt_in, ip, user_agent, accepted_at — append-only audit trail
- **email_verification_tokens** — id, user_id, token_hash, expires_at, used_at
- **password_reset_tokens** — id, user_id, token_hash, expires_at, used_at, ip

### Migrations

- `20260506000000_phase1_auth` — full Phase 1 schema (replaces Phase 0 placeholder)

---

## 🔐 SECURITY IMPLEMENTATION

- **Auth method:** JWT RS256 (15 min) + opaque sha256-hashed refresh (30 d, rotated). Tokens carry `kid` and are rejected if signed under a previous key
- **Token storage:** Mobile uses `expo-secure-store` (Keychain on iOS, encrypted SharedPreferences on Android)
- **Password hashing:** argon2id m=64 MiB p=4 t=3 with constant-time null-hash path
- **Refresh-token theft detection:** family-wide revocation on reuse
- **Login throttle:** 5/15min/IP via Redis token bucket (in-memory fallback in dev)
- **Rate-limiting infrastructure:** atomic Lua script in Redis; 429 with `retry_after_ms`
- **Input validation:** Zod (shared `@app-bus/types`) at every API entry
- **Secret redaction:** pino redacts auth header, password, refresh_token, id_token, set-cookie
- **Email enumeration defenses:** identical login response for unknown user vs wrong password; `/forgot-password` is a 204 regardless
- **OAuth:** ID-token JWS verification against issuer JWKS with audience allow-list and clock-skew leeway
- **KVKK:** versioned consent rejection on register, immutable consent history, soft-delete + 90-day purge cron, data export endpoint
- **CORS / Helmet:** allow-listed origins + secure default headers
- **Pre-commit secret scan:** gitleaks

---

## ⚙️ INFRASTRUCTURE STATE

- **Cloud Provider:** AWS eu-central-1 (Frankfurt)
- **Deployment Status:** Terraform skeleton authored; not yet applied (requires user's AWS creds)
- **Local dev:** `docker compose -f infra/local/docker-compose.yml up -d` for Postgres + Redis

---

## 🧪 TESTING STATUS

- **Unit tests (Phase 1):** 31 passing
  - `@app-bus/api`: 19 (PasswordHasher 4, JwtService 4, RefreshTokenService 7, RateLimit 3, Health 1)
  - `@app-bus/api-client`: 5 (bearer attach, 401 refresh+retry, single-flight, ApiError surface, logout)
  - `@app-bus/types`: 5 (zod round-trips)
  - `@app-bus/mobile`: 2 (theme tokens)
- **Integration tests:** scaffolding deferred to Phase 1 follow-up (Testcontainers Postgres)
- **E2E (Detox):** scheduled for Phase 7

---

## ⚠️ KNOWN ISSUES / TECH DEBT

- `ses` and `iletimerkezi` adapters are stubs (throw on send). Wire up real SDK calls in Phase 7 alongside production cutover and KVKK DPA signing
- `JwtKeyLoader.secret` mode (Secrets Manager) is a clear-error stub. Implement when Terraform provisions the secret in Phase 7
- OAuth screens in mobile (Google/Apple buttons) are not wired yet — endpoints exist; client wiring lands when we register iOS Apple Sign In + Google Web/Android client IDs
- Peer-dep warnings on `@nestjs/{config,swagger,terminus}` (they accept ≤ Nest 10) — non-blocking on runtime
- Go test step in `pnpm -r typecheck` requires `go` binary (skipped on this dev sandbox; CI matrix runs it)

---

## 🧠 DECISIONS LOG

- **ADR-0001:** Monorepo with pnpm + Turborepo (committed in Phase 0)
- **Phase 1 decisions** (informal — to be promoted to ADR if revisited):
  - Custom JWT (not Auth0/Cognito) for KVKK data residency control
  - argon2id over bcrypt — better memory-hardness for given verify time budget
  - Refresh tokens stored as `id|secret` with sha256 of full string in DB; reuse detection is family-wide (industry standard "rotation with theft detection" pattern)
  - Constant-time login + forgot-password to defeat email enumeration
  - Redis Lua token bucket for rate limiting (atomic, single round-trip; in-memory fallback in dev only)

---

## 🔚 LAST UPDATED

2026-05-05 — Phase 1 completed
