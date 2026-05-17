# app-bus — Real-Time Public Transport Tracker

Mobile-first, real-time public transportation tracking for major Turkish cities, starting with **Istanbul (İETT)** and **Ankara (EGO)**.

> **Project status:** Phase 0 (foundation & DevOps skeleton). See [`PROJECT_STATE.md`](./PROJECT_STATE.md) for live status and [`BUILD_ROADMAP.md`](./BUILD_ROADMAP.md) for the full plan.

---

## Architecture

```mermaid
flowchart LR
    subgraph M[Mobile · Expo SDK 52]
        APP[React Native app]
    end

    subgraph EDGE[Edge / API]
        API[apps/api · NestJS 11\nREST + GraphQL + Socket.IO]
    end

    subgraph WORKER[Ingestion]
        ING[apps/ingestion · Go 1.23\nvehicle position pipeline]
    end

    subgraph DATA[Datastores]
        PG[(Postgres + PostGIS\nPrisma migrations)]
        RED[(Redis\nstream + cache)]
    end

    subgraph PROV[Upstream feeds]
        IETT[İETT live data]
        EGO[EGO live data]
        GTFS[GTFS-RT feeds]
    end

    APP -- REST + WebSocket --> API
    API -- Prisma --> PG
    API -- subscribe --> RED
    ING -- ingest --> IETT
    ING -- ingest --> EGO
    ING -- ingest --> GTFS
    ING -- publish --> RED
    ING -- snapshots --> PG
```

The ingestion worker is a Go pipeline that polls operator feeds, normalizes positions into a single shape, snapshots to Postgres/PostGIS, and publishes deltas to a Redis stream that the NestJS API broadcasts over Socket.IO. The mobile client subscribes to per-route channels and renders vehicles on the map.

---

## Repository Layout

```
apps/
  api/         NestJS 11 REST/GraphQL + Socket.IO gateway · Prisma 6 · Postgres/PostGIS
  mobile/      Expo SDK 52 (React Native) — primary client
  web/         Companion web surface (admin / debug)
  ingestion/   Go 1.23 worker — vehicle position pipeline (Phase 3+)
packages/
  api-client/  Generated typed client (shared by web + mobile)
  config/      Shared eslint, prettier, tsconfig presets
  types/       Shared zod schemas + inferred TS types
infra/
  terraform/   AWS (eu-central-1) — VPC, ECS, Aurora, ElastiCache, Secrets, ECR
  local/       docker-compose.yml for local Postgres+Redis
  load-test/   k6 scripts
.github/
  workflows/   CI (lint, typecheck, test, terraform fmt, gitleaks)
docs/          Architecture notes + ADRs
```

---

## Stack

| Layer         | Choice                                                                                |
| ------------- | ------------------------------------------------------------------------------------- |
| Mobile        | Expo SDK 52, React Native, TypeScript                                                 |
| API           | NestJS 11 (REST + GraphQL + Socket.IO), TypeScript strict                             |
| ORM           | Prisma 6                                                                              |
| Database      | Postgres + PostGIS                                                                    |
| Cache / queue | Redis (streams for fan-out)                                                           |
| Ingestion     | Go 1.23 worker (distroless container)                                                 |
| Build         | Turborepo, pnpm 9 workspaces, Node 22 LTS                                             |
| Infra         | Terraform 1.10, AWS `eu-central-1` (VPC · ECS · Aurora · ElastiCache · Secrets · ECR) |
| CI            | GitHub Actions — lint, typecheck, test, `terraform fmt`, gitleaks                     |

---

## Local Quickstart (target < 30 minutes)

### Prerequisites

- **Node 22 LTS** (use `nvm install` from `.nvmrc`)
- **pnpm 9** via `corepack enable`
- **Go 1.23** for the ingestion worker
- **Docker** + **Docker Compose** for local Postgres / Redis
- **Terraform 1.10** (only if you provision infra)

### Steps

```bash
# 1. Install workspace dependencies
corepack enable
pnpm install

# 2. Boot Postgres + Redis locally
cd infra/local && docker compose up -d && cd ../..

# 3. Configure env files
cp apps/api/.env.example       apps/api/.env.local
cp apps/mobile/.env.example    apps/mobile/.env.local
cp apps/ingestion/.env.example apps/ingestion/.env

# 4. Apply Prisma migrations
pnpm --filter @app-bus/api prisma:deploy

# 5. Run everything in parallel
pnpm dev
```

What you get:

| Service   | URL                                               |
| --------- | ------------------------------------------------- |
| API       | http://localhost:3000/health                      |
| API docs  | http://localhost:3000/docs                        |
| Mobile    | Expo dev server (QR code)                         |
| Ingestion | http://localhost:8080/health                      |
| Postgres  | postgres://app_bus:app_bus@localhost:5432/app_bus |
| Redis     | redis://localhost:6379                            |

### Ingestion worker (Go)

```bash
cd apps/ingestion
make test     # vet + test with race detector
make run      # runs against env from .env
make docker   # builds distroless image
```

---

## Scripts (root)

| Script              | What it does                                     |
| ------------------- | ------------------------------------------------ |
| `pnpm dev`          | Run api + mobile + ingestion in parallel (Turbo) |
| `pnpm build`        | Build all workspaces                             |
| `pnpm lint`         | ESLint across the monorepo                       |
| `pnpm typecheck`    | `tsc --noEmit` per TS workspace                  |
| `pnpm test`         | Jest / Vitest suites                             |
| `pnpm format`       | Prettier — write                                 |
| `pnpm format:check` | Prettier — check (CI uses this)                  |

---

## Compliance

- **KVKK (Turkey)** + GDPR readiness — all data processed in `eu-central-1` (Frankfurt).
- Secrets live in **AWS Secrets Manager**; `.env` files are local-only and gitignored.
- Pre-commit hook runs `gitleaks` to block accidental commits of credentials.
- Commit messages enforced by **commitlint** (Conventional Commits).

---

## Engineering Discipline

`CLAUDE.md` is the canonical rule set for working in this repo. Highlights:

- **Phase isolation.** Only implement the current phase; do not skip ahead.
- **No duplication.** Reuse existing modules; never recreate a service that already exists.
- **Production-level code only.** No hacks; explicit error handling at every external boundary; no hardcoded secrets.
- **Separation of concerns.** Frontend, backend, and infrastructure each own their own surface.
- **Multi-city scalability** is a design constraint — Istanbul and Ankara are the first two; the schemas, services, and ingestion pipeline must scale to additional operators without rewrite.

---

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md).
