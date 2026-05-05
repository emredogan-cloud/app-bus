# Architecture overview

This document mirrors `BUILD_ROADMAP.md §3` and is the canonical pointer for new engineers.
It is updated only when an architectural decision is added in `docs/adr/`.

## High-level

```
mobile (Expo) ──┐
web (Next.js)  ─┴──> CloudFront + WAF ──> API Gateway ──┬─> NestJS API ─┬─> Postgres + PostGIS (Aurora)
                                                        │               ├─> Redis (ElastiCache)
                                                        └─> WebSocket   └─> EMQX MQTT
                                                            Gateway          ▲
                                                                             │
                                İETT / EGO / GTFS-RT  ──> Go ingestion ──────┴─> TimescaleDB
```

## Boundaries (do NOT mix)

| Layer             | Owns                                             | Forbidden                                     |
| ----------------- | ------------------------------------------------ | --------------------------------------------- |
| `apps/mobile`     | UI, client state, network calls via `api-client` | Direct DB or Redis access                     |
| `apps/api`        | REST/GraphQL aggregation, auth, business logic   | Long-running ingestion loops                  |
| `apps/ingestion`  | Live position pull from external feeds           | Serving HTTP to clients (only health/metrics) |
| `apps/eta-engine` | ETA computation                                  | Caching client requests                       |
| `infra/terraform` | All AWS resources                                | Application code                              |

## Data flow (live position)

1. Go worker polls İETT/EGO every 15s, normalizes into canonical `Position` struct.
2. Writes to Redis hash `vehicles:{city}:{route_id}` (TTL 90s) and TimescaleDB hypertable.
3. Publishes to MQTT topic `positions/{city}/{route_id}`.
4. NestJS WebSocket gateway bridges MQTT → connected mobile clients (msgpack-encoded deltas).

## ADRs

Architecture decisions are recorded in `docs/adr/NNNN-title.md`. See the
[ADR template](./../adr/template.md). Decisions go through PR review like code.
