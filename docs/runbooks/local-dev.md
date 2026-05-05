# Runbook — Local development

## Common issues

### `pnpm install` fails with peer dep warning

The repo uses `auto-install-peers=true`. If you see warnings, ensure your pnpm version is ≥9:

```bash
corepack prepare pnpm@9.12.0 --activate
```

### Postgres won't start with PostGIS

If `docker compose up postgres` errors on `postgis` extension:

1. Make sure you're using the `postgis/postgis:16-3.4` image (declared in `infra/local/docker-compose.yml`).
2. The init script `infra/local/postgres-init/01-extensions.sql` runs only on first volume bring-up. To reset:
   ```bash
   docker compose down -v && docker compose up -d
   ```

### Prisma migration fails with `relation already exists`

You're running migrations against a non-empty schema. Reset (DEV ONLY):

```bash
pnpm --filter @app-bus/api prisma migrate reset --skip-seed
```

### Mobile app can't reach api

Expo runs on a separate device/simulator and `localhost` resolves there, not on your host.
Set `EXPO_PUBLIC_API_URL=http://<host-lan-ip>:3000` in `apps/mobile/.env.local`, or use Expo's tunnel
(`pnpm --filter @app-bus/mobile dev -- --tunnel`).

### Go ingestion worker can't connect to Redis

The Phase 0 worker doesn't actually need Redis yet — it only serves `/health` and `/ready`. Redis wiring
arrives in Phase 3.
