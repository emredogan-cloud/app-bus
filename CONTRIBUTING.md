# Contributing

## Branching & commits

- `main` is protected. Work in topic branches: `feat/<short-desc>`, `fix/<short-desc>`, `phase/<n>-<name>`.
- Conventional commits enforced via `commitlint`: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`, `phase:` etc.
- One logical change per PR. Phase-level work goes into a single PR per phase (per `CLAUDE.md`).

## Pre-commit hooks

Husky runs:

1. **lint-staged** — Prettier formats only changed files.
2. **gitleaks** — blocks commits containing common secret patterns. Install:
   ```bash
   brew install gitleaks   # macOS
   # or: https://github.com/gitleaks/gitleaks#installing
   ```

If a hook fails, fix the issue and re-stage; **never** commit with `--no-verify` unless explicitly approved.

## Code style

- TypeScript strict mode is on across the repo. Don't loosen `tsconfig`.
- Imports: prefer `import type { … }` for type-only imports.
- No `console.log` in committed code (lint blocks it; use the pino logger).
- Tests live alongside source as `*.test.ts` (Vitest) or `*.spec.ts` (Jest), never in a separate `tests/` directory.

## Running tests locally

```bash
pnpm test                             # everything
pnpm --filter @app-bus/api test       # one workspace
pnpm --filter @app-bus/types test     # vitest
cd apps/ingestion && go test ./...    # go suite
```

## Pull request checklist

- [ ] CI is green (`lint`, `typecheck`, `test`, `terraform fmt`, `gitleaks`)
- [ ] No secrets, API keys, or PII added to the repo
- [ ] Updated `PROJECT_STATE.md` if the change introduces or removes a system
- [ ] If migrating Prisma: include the generated `migration.sql` (never edit a deployed migration)
- [ ] If changing public API: regenerated `packages/api-client` (added in Phase 2)

## Reporting security issues

Email **emre30283@gmail.com** with subject `SECURITY:`. Do not open public issues for vulnerabilities.
