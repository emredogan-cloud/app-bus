# Status page — operational runbook

App-Bus exposes its public uptime + incident history at
**`https://status.app-bus.tr`**, hosted on **BetterStack** (free tier sufficient
for the 200-IST + 50-ANK closed beta).

## Components monitored

| Component                                                    | Probe                                             | Threshold              |
| ------------------------------------------------------------ | ------------------------------------------------- | ---------------------- |
| Mobile API (`api.app-bus.tr/health`)                         | HTTP 200 every 60s                                | 3 fails / 3min → page  |
| WebSocket gateway (`api.app-bus.tr/v1/live`, namespace ping) | Custom probe every 60s                            | 5 fails / 5min         |
| İETT live feed                                               | Ingestion `source_lag_seconds{source="iett"}` p99 | > 120s for 5min → page |
| EGO live feed                                                | Same                                              | > 120s for 5min → warn |
| Database (Aurora)                                            | RDS CloudWatch `DatabaseConnections`              | sudden drop            |

## Incident workflow

1. PagerDuty alert fires (Datadog → PagerDuty webhook).
2. On-call posts an incident on BetterStack within 5 min (Investigating /
   Identified / Monitoring / Resolved).
3. Status page auto-pushes RSS + Slack updates to the `#status` channel and
   the team Telegram bot.
4. Post-mortem in `docs/runbooks/incidents/<date>-<slug>.md`.

## Demo / beta credentials

| Env                   | Email                 | Password                                                            |
| --------------------- | --------------------- | ------------------------------------------------------------------- |
| Beta TestFlight       | `betademo@app-bus.tr` | (rotated quarterly; in 1Password under "App-Bus / TestFlight demo") |
| Play Console internal | same as TestFlight    | same                                                                |

The demo account is pre-populated with three favorited stops in Istanbul
(Kadıköy İskele, Eminönü, Taksim Meydanı) so reviewers see real data on first
launch.
