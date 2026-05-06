# Disaster recovery runbook

**RTO target:** 2 hours · **RPO target:** 5 minutes

## Backup inventory

| Resource                                     | Backup mechanism                                           | Retention                      | Cross-region copy                                                    |
| -------------------------------------------- | ---------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------- |
| Aurora PostgreSQL (main)                     | RDS automated backups + 1-hour point-in-time               | 30 days                        | nightly snapshot copy to `eu-west-1`                                 |
| TimescaleDB hypertable (`vehicle_positions`) | Same Aurora cluster                                        | 30 days raw, 1 year aggregated | included in cluster snapshot                                         |
| Redis (ElastiCache)                          | RDB snapshot every 15 min                                  | 7 days                         | not replicated; rebuilt from Postgres + ingestion replay on failover |
| S3 (Protomaps tiles, model.pkl)              | versioned bucket + cross-region replication to `eu-west-1` | indefinite                     | yes                                                                  |
| Secrets Manager                              | AWS-native cross-region replication                        | n/a                            | yes                                                                  |
| ECR images (api, ingestion, eta-engine)      | replication rule to `eu-west-1`                            | indefinite                     | yes                                                                  |

## Failover procedure (region loss)

1. **Detect.** PagerDuty fires when health.app-bus.tr returns 5xx for > 5 min
   AND CloudFront origin health is unhealthy in eu-central-1.
2. **Decide.** On-call calls one of (CTO / Founder / Lead Eng) to confirm a
   region-level failover (vs partial outage).
3. **Promote.** Run `infra/terraform/envs/dr-failover/`:
   ```bash
   terraform workspace select prod-eu-west
   terraform apply -auto-approve
   ```
   This brings up Aurora from the latest cross-region snapshot and points
   Route 53 to the eu-west-1 ALB.
4. **Replay ingestion.** TimescaleDB position writes lost in the last 5
   minutes are replayed from the upstream İETT/EGO feeds (re-pull last 30 min
   automatically on cold start).
5. **Verify.** Health probes green; status page updated; engineers monitor
   error budget for 1 hour before declaring resolved.

## Restore from backup (DB corruption)

1. Identify timestamp `T` immediately before corruption.
2. `aws rds restore-db-cluster-to-point-in-time --restore-to-time T …` into a
   new cluster.
3. Run an integrity check; if good, switch app DATABASE_URL to the new cluster.
4. Run a daily catch-up of TimescaleDB raw rows from the live ingestion (the
   worker keeps a 30-day position buffer in memory by default; tune via
   `INGESTION_BUFFER_DAYS`).

## Annual DR drill

Every Q1: full failover exercise into eu-west-1 with synthetic traffic. Pass
criteria: <2h end-to-end, <5 min data loss, full automation (no manual steps
beyond the on-call confirmation).
