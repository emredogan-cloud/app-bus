# PROJECT_STATE.md

## 🧾 PROJECT OVERVIEW

**Project Name:** Real-Time Public Transport Tracker (app-bus)
**Status:** In Development
**Current Phase:** ✅ Phase 0 complete → about to start **Phase 1: Authentication & User Management**

---

## 🏗️ ARCHITECTURE SNAPSHOT

### Frontend (mobile)

- **Framework:** Expo SDK 52 + React Native 0.76 + TypeScript + expo-router (typed routes)
- **Structure:** `apps/mobile/{app, src/shared}` — feature-sliced layout (features added in Phase 1+)
- **Key Modules (Phase 0):** design tokens (`src/shared/theme.ts`), Sentry SDK init, splash screen
- **State management:** TBD — Zustand for UI state + TanStack Query for server cache (added in Phase 2)

### Backend (api)

- **Framework:** NestJS 11 + Node 22 LTS + TypeScript
- **API structure:** REST under `/v1`, OpenAPI 3.1 auto-generated, Swagger UI at `/docs` (non-prod)
- **Services (Phase 0):** `HealthModule`, `PrismaModule` (placeholder); auth/users/transit modules added in later phases
- **Middleware:** Helmet, CORS allow-list, pino structured logging with secret-redaction

### Backend (ingestion worker)

- **Framework:** Go 1.23 + slog
- **Layout:** `cmd/ingestion`, `internal/{config,health}` — source adapters and sinks added in Phase 3
- **Entrypoints:** `:8080/health`, `:8080/ready` (Phase 0)

### Database

- **Type:** PostgreSQL 16 + PostGIS 3.4 + citext + pg_trgm + unaccent
- **Local:** docker-compose Postgres at `infra/local/`
- **Cloud:** Aurora PostgreSQL serverless v2 (Phase 0 Terraform)
- **ORM:** Prisma 6 (placeholder schema in Phase 0)
- **Main tables:** `users` (placeholder, fleshed out in Phase 1)

### Infrastructure

- **Hosting:** AWS eu-central-1 (Frankfurt) — KVKK data residency
- **IaC:** Terraform 1.10 modules — VPC (3 AZ), ECR, ECS Fargate, RDS Aurora, ElastiCache Redis, Secrets Manager
- **CI/CD:** GitHub Actions (`ci.yml`) — lint / typecheck / test / terraform fmt-validate / gitleaks. OIDC AWS auth (no static keys).
- **Auth System:** Not yet implemented (Phase 1)

---

## ✅ COMPLETED PHASES

### Phase 0: Project Foundation & DevOps Skeleton

**Status:** ✅ Completed (2026-05-05)
**Summary:**

- Bootstrapped pnpm + Turborepo monorepo with `apps/{api,mobile,ingestion}` and `packages/{config,types}`
- NestJS 11 API skeleton: `/health`, `/healthz`, `/readyz`, pino logging with redaction, env validation via Zod, Sentry init, helmet, CORS, OpenAPI docs
- Prisma 6 init with placeholder `User` model and PostGIS/citext/pg_trgm/unaccent extension migration
- Multi-stage **distroless** Dockerfile for the API
- Expo SDK 52 + expo-router + Sentry SDK + design tokens; EAS Build profiles (dev/preview/prod)
- Go 1.23 ingestion worker: graceful shutdown, slog JSON/text logging, config from env, distroless Dockerfile, Makefile
- Shared `@app-bus/types` package with Zod schemas (auth, transit, common) — single source of truth across api ↔ mobile
- Shared `@app-bus/config` package with eslint + tsconfig presets
- Terraform IaC: VPC (3 AZ + NAT), ECR (immutable tags + lifecycle), ECS Fargate cluster, Aurora PostgreSQL serverless v2 with security groups, ElastiCache Redis 7, Secrets Manager scaffolding. State backend in S3+DynamoDB (`bootstrap-state.sh`).
- `infra/local/docker-compose.yml` for one-command Postgres+Redis dev
- GitHub Actions: matrix CI (Node + Go + Terraform + gitleaks), Dependabot, EAS workflow stub, OIDC-based AWS deploy stub
- Pre-commit: husky + lint-staged + gitleaks; commitlint with conventional commits
- Documentation: `README.md` (≤ 30-min onboarding), `CONTRIBUTING.md`, `docs/architecture/overview.md`, `docs/adr/0001-monorepo-layout.md`, `docs/adr/template.md`, `docs/runbooks/local-dev.md`
- `.editorconfig`, `.prettierrc`, `.gitignore`, `.gitleaks.toml`, `.dockerignore` per app

**Key Outputs:**

- Components / packages:
  - `apps/api` — `@app-bus/api`
  - `apps/mobile` — `@app-bus/mobile`
  - `apps/ingestion` — `@app-bus/ingestion`
  - `packages/types` — `@app-bus/types`
  - `packages/config` — `@app-bus/config`
- APIs (Phase 0):
  - `GET /health` — liveness (api)
  - `GET /healthz`, `GET /readyz` — readiness with deep checks (api)
  - `GET /health`, `GET /ready` — ingestion worker
- Services (Phase 0): `HealthController`, `PrismaService`, `PrismaHealthIndicator`
- IaC modules: `network`, `ecr`, `ecs`, `rds`, `redis`, `secrets`

**Verification:**

- ✅ `terraform fmt -recursive -check` passes
- ✅ `terraform validate` passes against `envs/dev`
- ✅ `pnpm install` succeeds (peer warnings from bleeding-edge Nest 11 satellites — non-blocking)
- ✅ `pnpm --filter @app-bus/types {typecheck,test}` — 5 vitest tests pass
- ✅ `pnpm --filter @app-bus/api {typecheck,build,test}` — 1 jest test passes, NestJS dist emitted
- ✅ `pnpm --filter @app-bus/mobile {typecheck,test}` — 2 jest tests pass
- ⚠️ Go test suite (`apps/ingestion`) requires `go` binary in CI runner — verified structurally; CI matrix runs it on `setup-go@v5`

---

## 🚧 CURRENT PHASE

### Phase 1: Authentication & User Management

**Objective:**

- Production-ready auth (email/password, Google, Apple OAuth)
- KVKK-compliant consent flow with versioned consent records
- JWT RS256 with refresh-token rotation + reuse detection
- `/v1/auth/{register,login,refresh,logout,oauth/...,forgot-password}`
- `/v1/users/me{,/export}` (KVKK data export)
- Mobile auth flow with biometric unlock (Premium gate)

**In Progress:**

- — (about to begin)

**Blocked / Issues:**

- — (none)

---

## 🔜 NEXT PHASES

- Phase 2: Static Transit Data — Stops, Routes, Schedules
- Phase 3: Real-Time Vehicle Position Ingestion
- Phase 4: Live Map — WebSocket Streaming to Mobile
- Phase 5: ETA Engine
- Phase 6: Favorites, Notifications, Personalization
- Phase 7: Offline Fallback, Performance Hardening, Beta Launch

(See `BUILD_ROADMAP.md` for the full plan including post-MVP phases 8–14.)

---

## 🧩 EXISTING SYSTEMS (DO NOT DUPLICATE)

### Authentication

- Status: Not implemented — placeholder `User` model only
- Type: TBD in Phase 1 (JWT RS256 + OAuth)
- Location: `apps/api/src/modules/auth/` (Phase 1)

### API Layer

- Base URL: `http://localhost:3000/v1` (dev)
- Structure: REST + OpenAPI 3.1, Swagger at `/docs`, RFC 7807 errors (Phase 1+)
- Health probes: `/health` (liveness), `/healthz`, `/readyz` (readiness)

### State Management (mobile)

- Tool: TBD (Zustand + TanStack Query — added in Phase 2)
- Usage: —

### UI System (mobile)

- Component library: bare expo-router app — shared `packages/ui` planned in Phase 9 (web)
- Design system: `apps/mobile/src/shared/theme.ts` (tokens-only baseline)

### Shared types

- Tool: `@app-bus/types` (Zod schemas → inferred TS types)
- Used by: `@app-bus/api`, `@app-bus/mobile`

---

## 🔌 API INTEGRATIONS

### External APIs

#### İETT (Istanbul Open API)

- Purpose: Live vehicle positions (Phase 3)
- Status: Planned — not yet wired

#### EGO (Ankara)

- Purpose: Live vehicle positions (Phase 3)
- Status: Planned — feed source TBD (custom scrape if no GTFS)

#### Sentry

- Purpose: Error tracking (mobile + api + ingestion)
- Status: SDK integrated; DSNs not yet configured (no-op until set)

---

## 🗃️ DATABASE STATE

### Tables / Collections

#### users (placeholder)

- Fields: `id (uuid PK)`, `email (citext unique)`, `created_at`, `updated_at`, `deleted_at`
- Note: Will be expanded in Phase 1 with `password_hash`, `locale`, `name`, `phone_e164`, `premium_tier`, etc.

### Migrations

- `20260505000000_init` — enables PostGIS, citext, pg_trgm, unaccent + creates `users`

---

## 🔐 SECURITY IMPLEMENTATION

- **Auth method:** Not yet implemented (Phase 1: JWT RS256)
- **Token handling:** —
- **Input validation:** Zod via `@app-bus/types` shared schemas
- **Secrets management:** AWS Secrets Manager (prod) + `.env.local` files gitignored (dev). `.env.example` per app.
- **Pre-commit secret scan:** gitleaks (`.gitleaks.toml`)
- **Headers:** Helmet defaults applied in API
- **CORS:** Allow-list from `CORS_ORIGINS` env

---

## ⚙️ INFRASTRUCTURE STATE

- **Cloud Provider:** AWS eu-central-1 (Frankfurt) — KVKK
- **Deployment Status:** Terraform skeleton authored; not yet `terraform apply`'d (requires user's AWS creds)
- **Environments:** `infra/terraform/envs/dev/` ready; staging + prod added in Phase 7
- **Local dev:** `docker compose -f infra/local/docker-compose.yml up -d` for Postgres + Redis

---

## 🧪 TESTING STATUS

- **Unit tests:**
  - `@app-bus/types`: 5 passing (vitest)
  - `@app-bus/api`: 1 passing (jest)
  - `@app-bus/mobile`: 2 passing (jest, theme tokens)
  - `@app-bus/ingestion`: structural Go tests authored (require `go` in CI)
- **Integration tests:** Planned — Testcontainers in Phase 1 (auth)
- **E2E tests:** Detox skeleton planned for Phase 1; Playwright skeleton planned for Phase 9

---

## ⚠️ KNOWN ISSUES / TECH DEBT

- Peer-dep warnings on `@nestjs/{config,swagger,terminus}` — they accept ≤ Nest 10. Tracking upstream; non-blocking on runtime.
- Mobile jest runs pure-logic tests only in Phase 0; full RN runtime under `jest-expo` preset is wired in Phase 4+.
- `go` not present in this dev sandbox — CI runs Go on `setup-go@v5`.

---

## 🧠 DECISIONS LOG

### ADR-0001: Monorepo with pnpm + Turborepo

- What: One repo, pnpm workspaces + Turborepo task graph; Go module wrapped via npm scripts.
- Why: Atomic schema refactors across api ↔ mobile; cached parallel CI; ≤ 30-min onboarding.

---

## 📌 NOTES FOR AI AGENT

- ALWAYS read this file before making changes
- NEVER duplicate existing systems
- ALWAYS update this file after completing a phase
- If something is missing → define it explicitly here

---

## 🔚 LAST UPDATED

2026-05-05 — Phase 0 completed
