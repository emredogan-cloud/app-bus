# app-bus — Real-Time Public Transport Tracker

Mobile-first, real-time public transportation tracking for major Turkish cities,
starting with **Istanbul (İETT)** and **Ankara (EGO)**.

> **Project status:** Phase 0 (foundation & DevOps skeleton). See
> [`PROJECT_STATE.md`](./PROJECT_STATE.md) for live status and
> [`BUILD_ROADMAP.md`](./BUILD_ROADMAP.md) for the full plan.

## Repo layout

```
apps/
  api/         NestJS 11 REST/GraphQL API + Prisma 6 + Postgres/PostGIS
  mobile/      Expo SDK 52 (React Native) — primary client
  ingestion/   Go 1.23 worker — vehicle position pipeline (Phase 3+)
packages/
  config/      Shared eslint, prettier, tsconfig presets
  types/       Shared zod schemas + inferred TS types
infra/
  terraform/   AWS (eu-central-1) — VPC, ECS, Aurora, ElastiCache, Secrets, ECR
  local/       docker-compose.yml for local Postgres+Redis
.github/
  workflows/   CI (lint, typecheck, test, terraform fmt, gitleaks)
docs/          Architecture notes + ADRs
```

## Local quickstart (target: < 30 minutes)

### Prerequisites

- **Node 22 LTS** (use `nvm install` from `.nvmrc`)
- **pnpm 9** via `corepack enable`
- **Go 1.23** for the ingestion worker
- **Docker** + **Docker Compose** for local Postgres/Redis
- **Terraform 1.10** (only needed if you provision infra)

### Steps

```bash
# 1. Install workspace dependencies
corepack enable
pnpm install

# 2. Boot Postgres + Redis locally
cd infra/local && docker compose up -d && cd ../..

# 3. Configure env files
cp apps/api/.env.example     apps/api/.env.local
cp apps/mobile/.env.example  apps/mobile/.env.local
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

## Scripts (root)

| Script              | What it does                             |
| ------------------- | ---------------------------------------- |
| `pnpm dev`          | Run api + mobile + ingestion in parallel |
| `pnpm build`        | Build all workspaces                     |
| `pnpm lint`         | ESLint across the monorepo               |
| `pnpm typecheck`    | `tsc --noEmit` for every TS workspace    |
| `pnpm test`         | Jest / Vitest suites                     |
| `pnpm format`       | Prettier — write                         |
| `pnpm format:check` | Prettier — check (CI uses this)          |

## Compliance

- **KVKK (Turkey)** + GDPR readiness — all data processed in `eu-central-1` (Frankfurt).
- Secrets live in **AWS Secrets Manager**; `.env` files are local-only and gitignored.
- Pre-commit hook runs `gitleaks` to block accidental commits of credentials.

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## License

UNLICENSED — proprietary. © 2026 App-Bus.
