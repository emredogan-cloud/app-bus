# Scale to 1M MAU — architecture (Phase 12)

The MVP topology (single ECS Fargate cluster + Aurora primary + ElastiCache
Redis single-AZ) handles 100k MAU comfortably. Scaling to 1M MAU at p95 < 200ms
requires the changes below.

## ECS → EKS migration

- Why: ECS Fargate's per-task overhead dominates as we add per-feature workers
  (ingestion, eta, notification, ml-inference). EKS gives us node-level
  bin-packing and a richer ecosystem (HPA, KEDA, Karpenter).
- Risk: production migration. Run in shadow with traffic mirroring for 2
  weeks before cutover.

## Postgres horizontal scaling

- Add 2 Aurora read replicas; the API uses Prisma's `replicaOf` to route reads.
- Heavy queries (`/v1/stops/nearby`, `/v1/search`, ETA reads) go to replicas.
- Writes (auth, favorites, notification logs) stay on the primary.

## Multi-region Redis

- ElastiCache Global Datastore: eu-central-1 primary + eu-west-1 read replica.
- Used during region failover and to serve warm-cache reads to eu-west-1
  edge locations.

## gRPC between internal services

- API ↔ ml-inference (Phase 11) and API ↔ ingestion are still HTTP today.
- gRPC saves 30-50% bandwidth on the position payload + sub-millisecond
  parse vs JSON. Migrate when k6 baseline shows TCP fan-in saturating.

## Vehicle position dedup

- Some routes are reported by multiple sources (e.g. İETT REST + a future
  GTFS-RT mirror). Dedup logic: prefer the freshest `recorded_at` per
  `(operator, vehicle_id)` and drop duplicates older than 30s.
- Handled in the ingestion worker before writing to Redis, so the API never
  sees duplicates.

## Wearables

- Apple Watch + Wear OS complications:
  - Authenticate via watch-paired phone (no separate login).
  - Single endpoint `/v1/wearables/next-arrivals?favorites=…` returns the top
    3 ETAs across favorited stops.
  - Cache-Control: `max-age=15, swr=30` (same as `/v1/stops/:id/etas`).

## Service mesh

- Istio or Linkerd for mTLS + retries + circuit breakers.
- Decide based on operational complexity vs control plane requirements.

## Distributed tracing

- OpenTelemetry SDK in api + ingestion + ml-inference; export to Datadog APM.
- Trace context propagated across:
  - HTTP REST (`traceparent` header)
  - WebSocket initial handshake
  - MQTT publish (custom MQTTv5 user-property)

## Chaos engineering

- Quarterly: kill an AZ; verify failover.
- Bi-annually: full DR drill (see `disaster-recovery.md`).
