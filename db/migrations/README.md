# Database Migrations

Plain PostgreSQL DDL (target: PostgreSQL 15+), numbered and applied in
order. Written as raw SQL rather than tied to a specific ORM/migration
tool, so whichever backend framework Phase 3 lands on (Prisma, Knex,
node-pg-migrate, Django, TypeORM, Flyway, ...) can adopt these files
as-is or import them as its baseline migration.

## Applying locally

```bash
createdb antech_erp
for f in db/migrations/*.sql; do psql -d antech_erp -v ON_ERROR_STOP=1 -f "$f"; done
```

Or with Docker:

```bash
docker run --name antech-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:15
for f in db/migrations/*.sql; do
  docker exec -i antech-pg psql -U postgres -v ON_ERROR_STOP=1 -f - < "$f"
done
```

## File order & scope

| File | Modules covered |
|---|---|
| `0001_core_and_identity.sql` | Tenant root, users, RBAC, audit log, login history, document numbering |
| `0002_crm.sql` | Module 2 — CRM |
| `0003_item_library_and_quotations.sql` | Module 3 — Quotation Management (+ shared item catalog) |
| `0004_projects.sql` | Module 4 — Project Management |
| `0005_suppliers_procurement_po.sql` | Modules 5 & 6 — Purchase Orders, Procurement |
| `0006_inventory.sql` | Module 7 — Inventory |
| `0007_progress_claims.sql` | Module 8 — Progress Claims |
| `0008_variation_orders.sql` | Module 9 — Variation Orders |
| `0009_project_costing.sql` | Module 10 — Project Costing |
| `0010_timesheets_and_payroll.sql` | Modules 11 & 12 — Timesheets, Payroll |
| `0011_accounting_invoices_payments.sql` | Module 13 — Accounting Integration (+ Invoices, Payments) |
| `0012_documents.sql` | Module 14 — Document Management |
| `0013_reporting.sql` | Module 15 — Reporting |
| `0014_notifications.sql` | Module 17 — Notifications |
| `0015_settings_and_approval_engine.sql` | Module 18 — Settings (+ generic Approval Workflow engine) |
| `0016_seed_permissions.sql` | Seed data: global `permissions` catalog |
| `0017_refresh_tokens.sql` | Addendum (added during Phase 5): server-side refresh-token rotation/revocation for Auth |
| `0018_project_document_numbering.sql` | Addendum (added during Phase 5): adds `project` to the document-numbering CHECK list, for Quotation → Project conversion |
| `0019_purchase_order_rejected_status.sql` | Addendum (found by the TypeScript compiler during Phase 5 review): adds `rejected` to `purchase_orders.status` — a Phase 2 oversight, caught before it could hit a live CHECK constraint |

Module 1 (Dashboard) and Module 16 (User Management) have no migration
of their own — Dashboard is read-only queries over everything above,
and User Management is `users`/`roles`/`permissions`/`audit_logs` from
`0001`.

## Conventions

See [`docs/phase-2-database-design/schema-dictionary.md`](../../docs/phase-2-database-design/schema-dictionary.md#conventions-used-throughout-every-migration)
for the full list (UUID PKs, `company_id` tenant scoping, soft deletes,
money/quantity precision, status-as-`CHECK`-constraint, etc).

## Forward-declared foreign keys

A few columns reference a table defined in a *later* file, because the
natural module order created a short dependency cycle (e.g. `quotations`
wants to point at its `current_revision_id`, but `quotation_revisions`
must reference `quotations` first). These are declared as a plain `UUID`
column where first introduced, then wired up with `ALTER TABLE ... ADD
CONSTRAINT ... FOREIGN KEY` later in the same file (same-file cycles) or
in a subsequent file (cross-file cycles). Each occurrence is commented
inline with `-- FK added in NNNN once <table> exists`. All are resolved
by the end of `0016`; the migration set has been checked end-to-end for
forward references that are *not* resolved (see verification below).

## Verification performed on this migration set

- Every file parses cleanly under `sqlfluff parse --dialect postgres`
  (no syntax errors).
- A static pass confirms all 87 tables have unique names and every
  `REFERENCES`/`ALTER TABLE ... REFERENCES` target is defined by the
  point it's used, given the file order above.
- **Not yet done:** an actual `CREATE`-and-load run against a live
  Postgres instance (no local Postgres/Docker was available in the
  environment these were authored in). Run the "Applying locally" steps
  above — or wire this into CI in Phase 9 — before relying on this set
  in a real environment. Semantic issues that only surface at execution
  time (e.g. a `CHECK` constraint edge case) wouldn't be caught by
  parsing alone.

## Tenant-data seeding (not in these migrations, by design)

`roles` and `role_permissions` are per-company (`roles.company_id NOT
NULL`) and therefore can't be seeded by a migration before any company
exists. The default role set from SRS §3.1 (Owner, Managing Director,
Project Manager, Project Engineer, Site Supervisor, Quantity Surveyor,
Procurement Officer, Store Keeper, Accounts, HR, Payroll, Employee) and
their default permission grants are created by the application's "new
company" bootstrap routine in Phase 5 (Backend APIs), using the
`permissions` table seeded in `0016` as its source list.
