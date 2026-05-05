# ADR-0001: Monorepo with pnpm workspaces + Turborepo

- **Status:** Accepted
- **Date:** 2026-05-05
- **Deciders:** @emre

## Context

The project ships a Node API, a React Native app, a Go ingestion worker, shared TS types,
and Terraform IaC. We need:

- One source of truth for shared types (auth + transit schemas) consumed by mobile, web (Phase 9), and api.
- Atomic refactors across api ↔ mobile when public schemas change.
- Cached, parallel CI to keep the dev loop fast (target ≤ 30 min onboarding).

## Decision

Use **pnpm 9 workspaces** for dependency management plus **Turborepo 2** for the task graph.

Layout:

- `apps/*` — deployables (api, mobile, ingestion, eta-engine, web)
- `packages/*` — non-deployable libraries (config, types, api-client, ui)
- `infra/*` — IaC and operational tooling

Go lives outside the npm graph (`apps/ingestion/go.mod`) but is wrapped with npm scripts so
Turborepo can sequence `lint`, `test`, and `build` uniformly.

### Alternatives rejected

- **Nx** — more opinionated and heavier for our stack; Turborepo's caching + simpler config was sufficient.
- **Polyrepo** — costs more for the cross-cutting type safety guarantee we want.

## Consequences

- New engineers run `corepack enable && pnpm install` once at root.
- All TS workspaces inherit `tsconfig.base.json` strict settings — no per-app drift.
- Adding a new app means dropping it into `apps/` with a `package.json` that references shared `packages/*`.
- Go is intentionally first-class via Make, not papered over with npm scripts only.
