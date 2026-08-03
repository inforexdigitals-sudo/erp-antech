# Deployment Model

Two profiles, same containers: a **cheap single-VPS profile** for V1
(one company, cost-sensitive SMB target), and a **growth-path managed
profile** to move to once horizontal scaling or multi-tenant SaaS is
actually needed. Moving between them is a config/infra change, not an
application rewrite, because the app tier is already stateless.

## 1. V1 Profile — Single VPS, Docker Compose

```
Internet
   │  HTTPS (443)
   ▼
Caddy (reverse proxy, automatic Let's Encrypt TLS)
   │
   ├── /api/*  → api container  (NestJS, port 3000 internal)
   └── /*      → web container  (static build, served by Caddy or nginx)

Sidecar containers on the same host/network:
   - postgres (persistent volume)
   - redis
   - minio (S3-compatible object storage, persistent volume)
   - worker (BullMQ processor — same image as api, different start command)
```

- Single `docker-compose.prod.yml` (see [infra/docker-compose.prod.yml](../../infra/docker-compose.prod.yml))
  brings up the whole stack on one host (e.g. a $20–40/mo VPS — Hetzner,
  DigitalOcean, Lightsail — sized for one company's traffic).
- All configuration via environment variables (`.env`, not committed —
  see `.env.example`), consistent with the 12-factor NFR.
- **Backups:** nightly `pg_dump` (cron container or host cron) streamed
  to the same MinIO bucket (or an external S3 bucket) with a 30-day
  retention; documents/photos already live in MinIO, which is backed up
  separately or replicated to real S3.
- **This profile is a real limitation, stated plainly:** single point of
  failure, no automatic failover, vertical-scale-only. That's the right
  trade for "initially only one company will use it" — the growth-path
  profile below exists for when that's no longer true, and nothing
  about the app needs to change to get there.

## 2. Growth-Path Profile — Managed Cloud

When horizontal scaling, multi-tenant SaaS, or high availability
actually become requirements (not before — this is deliberately not
built speculatively):

```
                        ┌─────────────────────┐
Internet ── HTTPS ──►   │  Load Balancer (ALB) │
                        └──────────┬───────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                              ▼
            api container (N)              api container (N)
            (ECS Fargate / K8s pods,          autoscaled on
             stateless, scales out)            CPU/request count
                    │                              │
                    └──────────────┬───────────────┘
                                   ▼
                    ┌──────────────────────────────┐
                    │ Managed Postgres (RDS/Cloud SQL) │  + read replica for reporting
                    │ Managed Redis (ElastiCache)      │
                    │ S3 (real, not MinIO)             │
                    └──────────────────────────────┘
                                   ▲
                    worker containers (BullMQ), scaled independently of API
```

- Infra-as-code (Terraform) added under `infra/terraform/` at this
  point — not before, since hand-writing Terraform for a single-VPS
  deployment is pure overhead.
- Cloud provider is **not locked in by this architecture** — AWS is the
  default recommendation (RDS/ElastiCache/S3/ECS Fargate cover every
  need with minimal ops burden for a small team), but Azure or GCP
  equivalents swap in without touching application code, since nothing
  above depends on an AWS-specific SDK beyond the S3-compatible storage
  client (which MinIO, Azure Blob-with-S3-gateway, and GCS-with-
  interop all satisfy).

## 3. CI/CD Pipeline (GitHub Actions)

```
On pull request  →  ci.yml
  1. install (cached)
  2. lint (eslint) + typecheck (tsc --noEmit)
  3. unit + integration tests (Jest, against a disposable Postgres service container)
  4. build (api + web)
  → PR blocked from merge until all steps pass

On merge to main  →  deploy.yml
  1. everything in ci.yml, plus:
  2. build & push Docker images (api, web, worker) to a container registry, tagged with the commit SHA
  3. run pending migrations against the target database (db/migrations/*.sql, in order — see db/migrations/README.md)
  4. deploy:
     - V1 profile: SSH to the VPS, `docker compose pull && docker compose up -d`
     - growth-path profile: update ECS task definition / K8s rollout with the new image tag
  5. smoke-test the health endpoint post-deploy; auto-rollback on failure (growth-path profile)
```

Concrete workflow files are scaffolded at
[.github/workflows/ci.yml](../../.github/workflows/ci.yml) and
[.github/workflows/deploy.yml](../../.github/workflows/deploy.yml) —
steps 2–3 of `deploy.yml` are stubbed with `TODO` markers since they
depend on the container registry and target host/cluster that get
decided when this phase is approved.

## 4. Environments

| Environment | Purpose | Data |
|---|---|---|
| `local` | Developer machines | `docker-compose.yml`, seeded fixture data |
| `staging` | Pre-production validation, same topology as chosen profile | Anonymized/synthetic data, never real customer data |
| `production` | Live | Real data, automated backups, restricted access |

## 5. Secrets

- **V1:** `.env` file on the VPS, not committed, permissions locked to
  the deploy user; rotated manually on suspected exposure.
- **Growth-path:** a managed secrets store (AWS Secrets Manager /
  Parameter Store or equivalent), injected as environment variables at
  container start — never baked into an image layer.
- Encrypted-at-rest fields in the schema itself (`users.two_factor_secret_encrypted`,
  `accounting_connections.access_token_encrypted`/`refresh_token_encrypted`,
  Phase 2) are encrypted with a key from this secrets store, not
  hardcoded — the app-level encryption key is itself a secret.

## 6. Observability (baseline for V1, expand later)

- Structured JSON logs (`correlationId` on every line, per
  [api-architecture.md](api-architecture.md)) to stdout — captured by
  Docker's log driver, shippable to any log aggregator later without
  changing application code.
- Health check endpoint (`GET /api/v1/health`) for the reverse proxy /
  load balancer and CI smoke tests.
- Metrics/tracing (Prometheus, OpenTelemetry) are a growth-path addition,
  not required to meet the stated NFRs at V1 scale — flagged here so
  it's a conscious deferral, not an oversight.
