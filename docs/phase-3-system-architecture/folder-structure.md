# Folder Structure

Monorepo, npm workspaces (no need for Nx/Turborepo complexity at this
scale — revisit only if build times become a real problem). Actual
application code is written in Phases 5–6; this phase creates the
skeleton and infra scaffolding only.

```
antech-erp/
├── apps/
│   ├── api/                          # NestJS backend
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/             # login, refresh, 2FA, password reset
│   │   │   │   ├── users/            # module 16: users, roles, permissions
│   │   │   │   ├── crm/              # module 2
│   │   │   │   ├── quotations/       # module 3
│   │   │   │   ├── projects/         # module 4
│   │   │   │   ├── procurement/      # modules 5 & 6: material requests, RFQ, PO
│   │   │   │   ├── inventory/        # module 7
│   │   │   │   ├── claims/           # module 8
│   │   │   │   ├── variation-orders/ # module 9
│   │   │   │   ├── costing/          # module 10
│   │   │   │   ├── timesheets/       # module 11
│   │   │   │   ├── payroll/          # module 12
│   │   │   │   ├── accounting/       # module 13 (+ invoices/payments)
│   │   │   │   ├── documents/        # module 14
│   │   │   │   ├── reporting/        # module 15
│   │   │   │   ├── notifications/    # module 17
│   │   │   │   ├── settings/         # module 18 (+ approval workflow engine)
│   │   │   │   └── dashboard/        # module 1 (composes other modules' read services)
│   │   │   │
│   │   │   │   # each module folder follows the same internal shape:
│   │   │   │   #   <module>.module.ts
│   │   │   │   #   <module>.controller.ts
│   │   │   │   #   <module>.service.ts
│   │   │   │   #   <module>.repository.ts
│   │   │   │   #   dto/            (request/response DTOs, Zod or class-validator)
│   │   │   │   #   entities/       (module-local types, not DB models)
│   │   │   │   #   <module>.service.spec.ts
│   │   │   │   #   <module>.controller.spec.ts
│   │   │   │
│   │   │   ├── common/
│   │   │   │   ├── guards/           # TenantGuard, JwtAuthGuard, PermissionsGuard
│   │   │   │   ├── interceptors/     # AuditInterceptor, TransformResponseInterceptor
│   │   │   │   ├── decorators/       # @RequirePermission(), @CurrentUser()
│   │   │   │   ├── filters/          # global exception filter -> error shape
│   │   │   │   ├── pipes/            # validation pipes
│   │   │   │   └── approval/         # generic approval-workflow engine (shared across modules)
│   │   │   ├── config/                # env schema + typed config service
│   │   │   ├── database/
│   │   │   │   ├── prisma/            # prisma.service.ts, generated client
│   │   │   │   └── seed/              # dev seed data, role-bootstrap-on-company-create logic
│   │   │   ├── jobs/                  # BullMQ queue definitions + processors
│   │   │   │   ├── pdf-generation/
│   │   │   │   ├── email/
│   │   │   │   ├── payroll-export/
│   │   │   │   └── accounting-sync/
│   │   │   ├── integrations/
│   │   │   │   ├── accounting/        # xero.adapter.ts, quickbooks.adapter.ts, adapter interface
│   │   │   │   ├── storage/           # s3.service.ts (presigned URLs)
│   │   │   │   └── notifications/     # email.provider.ts, sms.provider.ts, whatsapp.provider.ts, push.provider.ts
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   ├── test/                      # e2e (Supertest) specs, one file per module's golden path
│   │   ├── Dockerfile
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── web/                           # React frontend
│       ├── src/
│       │   ├── features/              # mirrors backend modules 1:1
│       │   │   ├── crm/
│       │   │   ├── quotations/
│       │   │   ├── projects/
│       │   │   ├── procurement/
│       │   │   ├── inventory/
│       │   │   ├── claims/
│       │   │   ├── variation-orders/
│       │   │   ├── costing/
│       │   │   ├── timesheets/
│       │   │   ├── payroll/
│       │   │   ├── accounting/
│       │   │   ├── documents/
│       │   │   ├── reporting/
│       │   │   ├── notifications/
│       │   │   ├── settings/
│       │   │   └── dashboard/
│       │   │       # each feature folder:
│       │   │       #   components/   (feature-local UI)
│       │   │       #   hooks/        (TanStack Query hooks: useQuotations(), useCreatePO())
│       │   │       #   api.ts        (typed fetch calls to the backend module)
│       │   │       #   types.ts
│       │   │       #   pages/        (route-level components)
│       │   ├── components/            # shared design-system components (Button, DataTable, Modal, ...)
│       │   │   └── ui/                # shadcn/ui primitives, themeable via CSS variables
│       │   ├── layouts/               # AppShell, AuthLayout, PortalLayout
│       │   ├── routes/                # React Router route tree, role-gated route guards
│       │   ├── stores/                # Zustand: theme, auth session, ui state
│       │   ├── lib/
│       │   │   ├── api-client.ts      # fetch wrapper (auth header, refresh-on-401, error mapping)
│       │   │   ├── query-client.ts    # TanStack Query client config
│       │   │   └── utils.ts
│       │   ├── theme/                 # dark/light tokens (CSS variables), Tailwind config hookup
│       │   ├── App.tsx
│       │   └── main.tsx
│       ├── public/
│       ├── Dockerfile
│       ├── tsconfig.json
│       ├── tailwind.config.ts
│       └── package.json
│
├── packages/
│   ├── shared-types/                  # DTOs/enums shared between api and web (single source of truth)
│   │   └── src/
│   ├── config/                        # shared eslint/prettier/tsconfig base configs
│   └── ui-tokens/                     # design tokens (color/spacing/typography) consumed by both
│                                        # Tailwind config and any future native app
│
├── db/
│   └── migrations/                    # Phase 2 deliverable — already in place
│
├── infra/
│   ├── docker/
│   │   └── docker-compose.yml         # local dev: postgres, redis, minio, api, web
│   ├── docker-compose.prod.yml        # single-VPS production profile
│   └── terraform/                     # growth-path cloud IaC — added when horizontal scaling is needed, not V1
│
├── .github/
│   └── workflows/
│       ├── ci.yml                     # lint, typecheck, test, build on every PR
│       └── deploy.yml                 # build+push images, deploy, on merge to main
│
├── docs/                              # Phases 1-3 deliverables (this document included)
├── .env.example
├── package.json                       # workspace root
├── pnpm-workspace.yaml                # (or npm/yarn workspaces — see note)
└── README.md
```

## Notes

- **Package manager:** recommend `pnpm` for workspace disk efficiency
  and stricter dependency resolution; `npm` workspaces is an acceptable
  fallback with zero functional difference to this structure if you'd
  rather not introduce another tool.
- **`features/` mirrors `modules/` 1:1** on purpose — anyone who knows
  the backend module for "Variation Orders" already knows where its
  frontend code lives, and vice versa. This is the "feature-based
  folders" requirement made concrete.
- **`shared-types` is the contract** between frontend and backend: DTOs
  defined once, imported by both `api` (as its response/request types)
  and `web` (as its fetch/query types). Prevents the two sides drifting
  out of sync, which is the most common source of bugs in REST-based
  full-stack apps once a project grows past a few modules.
- **Nothing in `apps/api/src/modules/*` talks to Prisma directly except
  that module's own `*.repository.ts`.** This is what keeps the
  Repository Pattern real rather than decorative — a service never
  imports `PrismaClient`.
