# Infrastructure (Terraform)

Phase 0 deliverable: provisions the dev environment in **AWS eu-central-1 (Frankfurt)**
to satisfy KVKK data-residency.

## Modules

- `modules/network` — VPC (3 AZ), public + private subnets, NAT gateway, security groups
- `modules/ecr` — Container repos for `api`, `ingestion`, `eta-engine`
- `modules/ecs` — Fargate cluster + task execution role
- `modules/rds` — Aurora PostgreSQL serverless v2 with PostGIS
- `modules/redis` — ElastiCache Redis 7 (single-node in dev)
- `modules/secrets` — Secrets Manager bootstrap (DB credentials, JWT keys placeholders)

## Environments

- `envs/dev` — single-AZ NAT, t-class compute, Aurora ACU 0.5–2
- `envs/staging` — added in Phase 7
- `envs/prod` — added in Phase 7

## Backend (state)

State lives in S3 (`app-bus-tfstate`) with DynamoDB lock table (`app-bus-tflock`).
The bootstrap script `bootstrap-state.sh` creates these once per AWS account.

## Quickstart

```bash
cd envs/dev
cp terraform.tfvars.example terraform.tfvars   # then fill in
terraform init
terraform plan -out=plan.tfplan
terraform apply plan.tfplan
```

## Authentication

CI/CD uses GitHub Actions OIDC (no long-lived keys). Locally, use AWS SSO:

```bash
aws sso login --profile app-bus-dev
export AWS_PROFILE=app-bus-dev
```
