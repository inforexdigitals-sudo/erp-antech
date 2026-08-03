# Antech ERP

A lightweight, cloud-based ERP platform for engineering contractors —
quotation through project close, in one system.

## Project status

Being built phase-by-phase, each gated on approval before the next
starts. See [docs/](docs/) for every phase's deliverable.

| Phase | Deliverable | Status |
|---|---|---|
| 1 | Business Analysis (SRS) | ✅ [docs/phase-1-business-analysis/SRS.md](docs/phase-1-business-analysis/SRS.md) |
| 2 | Database Design | ✅ [docs/phase-2-database-design/](docs/phase-2-database-design/) · [db/migrations/](db/migrations/) |
| 3 | System Architecture | ✅ [docs/phase-3-system-architecture/](docs/phase-3-system-architecture/) |
| 4 | UI Wireframes | ✅ [docs/phase-4-ui-wireframes/](docs/phase-4-ui-wireframes/) |
| 5 | Backend APIs | 🔶 batch 6 of N — [apps/api/](apps/api/) · [docs/phase-5-backend-apis/](docs/phase-5-backend-apis/) |
| 6 | Frontend | 🔶 batch 2 of N — [apps/web/](apps/web/) |
| 7 | Authentication & Authorization | ⏳ not started |
| 8 | Testing | ⏳ not started |
| 9 | Deployment | ⏳ not started |
| 10 | Documentation | ⏳ not started |

## Repository layout

```
apps/api/         NestJS backend (scaffolded, code lands in Phase 5)
apps/web/         React frontend (scaffolded, code lands in Phase 6)
packages/         Shared types & config used by both apps
db/migrations/     PostgreSQL schema — 87 tables across 18 modules (Phase 2)
infra/             Docker Compose (dev + prod) and CI/CD scaffolding
docs/              SRS, ERD, schema dictionary, architecture docs per phase
```

Full explanation of every directory:
[docs/phase-3-system-architecture/folder-structure.md](docs/phase-3-system-architecture/folder-structure.md)

## Stack

PostgreSQL · NestJS + TypeScript + Prisma · React + Vite + Tailwind +
shadcn/ui · Redis + BullMQ · S3-compatible storage · Docker. Full
rationale: [docs/phase-3-system-architecture/architecture-overview.md](docs/phase-3-system-architecture/architecture-overview.md)

## Getting started

```bash
cp .env.example .env        # fill in real values
pnpm install
docker compose -f infra/docker/docker-compose.yml up -d postgres redis minio
bash db/migrations/apply.sh
pnpm dev
```

Phase 5 (backend, batch 6 of N) and Phase 6 (frontend, batch 2 of N) both
have real, verified application code now, wired end-to-end against a
live local database — every module with a working backend API now has
a working frontend to match, except CRM, Inventory, Reports, and
Settings & RBAC (no backend for any of those yet). See
[apps/api/README.md](apps/api/README.md) and
[apps/web/README.md](apps/web/README.md) for exactly what's built,
what's stubbed, and what verification actually found.
