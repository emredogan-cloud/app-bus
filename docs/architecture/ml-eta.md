# ML ETA — architecture (Phase 11)

The Phase 5 heuristic ETA hits ≤90s median error on top-20 routes. To get to
≤45s we trade simplicity for a learned model.

## Data flow

```
TimescaleDB (vehicle_positions, 6+ months)
        │
        ▼
[ ml-trainer ]  weekly retrain (SageMaker Pipelines or Airflow)
        │
        ▼
S3 model.pkl (versioned, signed)
        │
        ▼
[ ml-inference ]  FastAPI + LightGBM, 3 replicas behind ALB
        │  POST /predict { route_id, segment_id, hour, dow, weather, recent_speed }
        │  → { eta_seconds, confidence }
        │
        ▼
NestJS API (apps/api/src/modules/eta)  →  Redis ZSET etas:stop:{stop_id}
```

The NestJS API does NOT host the model. Inference runs in a separate Python
service (`apps/ml-inference`, not yet committed) so we can scale ML latency
independently of API throughput, and so the data engineering team can iterate
on the model without redeploying the API.

## A/B routing

`AbRouter.pick({ userId })` returns `'heuristic' | 'ml'` based on a stable
sha256 bucket of `(experiment, user_id)` partitioned by `ML_ETA_TRAFFIC_PCT`
(0..100). Anonymous users always get the heuristic.

## Features

| Feature                        | Source                                | Note                             |
| ------------------------------ | ------------------------------------- | -------------------------------- |
| `route_id`                     | route_stops                           | one-hot encoded at training time |
| `segment_id`                   | route shape divided into 200m buckets | precomputed                      |
| `hour_of_day`                  | RecordedAt                            | local TZ                         |
| `dow`                          | RecordedAt                            | Mon=0..Sun=6                     |
| `weather_condition`            | OpenWeather API                       | (Phase 11.5)                     |
| `recent_speed_ewma`            | Phase 5 EwmaSpeedTracker              | reused as a feature              |
| `historical_segment_speed_p50` | TimescaleDB rollup                    | nightly materialized view        |

## Training pipeline (separate Python repo `apps/ml-trainer`)

```
extract.py    — pulls 90d of vehicle_positions + actual stop arrivals
                 (vehicle within 50m of stop) → feature/label CSV
train.py      — LightGBM with 5-fold CV, MAE objective
evaluate.py   — per-route MAE, p50, p90, p95 against the heuristic baseline
publish.py    — uploads model.pkl + metadata.json to S3, bumps the model
                 version in Parameter Store
```

Cadence: weekly (Sunday 04:00 UTC). Failed trainings page on-call.

## Inference service

```
apps/ml-inference/
├── main.py                # FastAPI; /predict endpoint
├── model_loader.py        # downloads versioned model from S3 on startup
├── features.py            # parity with train-time feature builder
└── Dockerfile             # python:3.12-slim, gunicorn workers
```

Cold-start budget: < 30s (model download + warm cache).
p99 inference latency target: < 50ms.

## Fallback

If the inference service returns 5xx, slow (>500ms), or returns NaN, the API
silently falls back to the Phase 5 heuristic. We log a metric
`ml_inference_fallbacks_total` so we know when the model is misbehaving.

## Status (2026-05-05)

Phase 11 commits the routing layer + A/B framework only — the model itself
needs ≥ 6 months of TimescaleDB data which is accumulated post-MVP.
