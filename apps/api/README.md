# Antech ERP API

NestJS backend. See [docs/phase-3-system-architecture/](../../docs/phase-3-system-architecture/)
for the architecture this follows, and [docs/phase-5-backend-apis/](../../docs/phase-5-backend-apis/)
for the phase-5 status notes.

## Status: Phase 5, batch 5 of N

Phase 5 covers 18 backend modules; building all of them in one pass
wasn't practical to review carefully, so this lands as batches.

### Fully built (controller → service → repository → Prisma, with tests)

**Batch 1:**
- **Auth** — login, refresh-token rotation with reuse detection, TOTP
  2FA, Argon2id password hashing, RBAC permission resolution embedded
  in the access token.
- **Quotations** (module 3) — CRUD, immutable revisions, per-line
  markup/discount/tax pricing, submit/approve/reject via the shared
  approval engine, send (stub delivery — see below), convert-to-project.
- **Purchase Orders + Suppliers** (module 5) — supplier CRUD, PO CRUD,
  submit/approve/reject, issue (stub delivery), partial-delivery
  receiving with over-receipt guards and per-line completion tracking,
  cancel (draft/pending-approval only — see "Verified" §12 for why
  cancelling an approved PO isn't supported yet).

**Batch 2** (explicitly scoped by request to skip Inventory and CRM
for now — see "Deferred, not dropped" below):
- **Project Management** (module 4) — project CRUD, team members,
  milestones, tasks, site reports, issues (with `resolvedAt` correctly
  stamped/cleared on status transitions). Site report photos are not
  built — they depend on Document Management (module 14), which
  doesn't exist yet.
- **Project Costing** (module 10) — budget initialization from a
  linked quotation's priced revision (grouped into one budget line per
  cost category) or manual entry for projects without one; the
  append-only `cost_transactions` ledger; a dashboard endpoint
  computing budget/committed/actual/forecast/variance per category and
  in total. Forecast is `committed + actual` only — FR-10.4 wants an
  estimate-to-complete folded in too, and there's no ETC input
  mechanism yet; documented in `CostingService.getDashboard`, not
  silently assumed to be zero.
- **Purchase Orders is now wired as a cost-ledger producer**: approving
  a PO commits its line totals (grouped by category) to the linked
  project's budget; each delivery releases the committed amount for
  what was received and records it as actual, so committed+actual
  stays equal to the original commitment as delivery progresses. This
  closes the gap batch 1 flagged ("Costing side-effects... because that
  module doesn't exist yet") now that it does. **Known gap:** the PO
  status write and the cost-ledger writes are two separate operations,
  not one transaction — a crash in between would leave them
  inconsistent. Accepted for this batch; a real fix is a saga/outbox
  pattern. Documented inline in `purchase-orders.service.ts`.

**Batch 3** (extends the same "producer into the cost ledger" pattern
Purchase Orders established in batch 2):
- **Variation Orders** (module 9) — CRUD with per-line cost/revenue
  impact (missing quantity/price on a line means $0 for that line, not
  a validation error — `variation_order_items` has no `NOT NULL` on
  those columns, unlike quotation items), re-pricing (items are
  replaced in place and the new totals logged as a revision — VO items
  have no revision FK of their own, unlike quotation items, so this is
  a genuinely different versioning shape and is documented as such),
  submit/approve/reject via the shared approval engine. **Internal
  approval commits cost to the project ledger immediately** (the
  company incurs that cost once it authorizes the work); **client
  sign-off is a separate step that's when revenue actually lands on
  the project's contract value** — modeled as two distinct actions
  (`requestClientSignOff` / `recordClientSignOff`) rather than one,
  since a company can authorize work internally well before a client
  has contractually agreed to pay more for it. No client portal exists
  yet, so sign-off is recorded by internal staff on the client's
  behalf (same pattern as SiteReports), not submitted by the client.
- **Timesheets + Leave** (module 11) — clock-in/out (one shift per
  calendar day, matching `timesheets`' `UNIQUE(user_id, work_date)`;
  computes total/overtime hours off an 8-hour daily default since no
  configurable threshold exists yet), manual entry for office/backfill
  use, per-project hour allocation (capped at the day's total hours),
  submit/approve via the shared approval engine; leave types, leave
  requests (decided directly, *not* through the approval engine —
  `leave_requests` has no `approval_workflow_id` in the Phase 2 schema,
  a design choice from that phase, not an oversight, kept faithful to
  here), and leave balances credited automatically on approval.
  **Deliberately not wired to the cost ledger**: FR-10.2 wants an
  approved timesheet to record actual labour cost, but that needs an
  hourly-rate source (per-user wage, or a role/cost-code rate table)
  that doesn't exist anywhere in this schema. Inventing one would mean
  fabricating financial data — left for whenever Payroll (module 12) or
  a dedicated rate table gets designed, not guessed at here.

**Batch 4** (Subcontractors, Progress Claims, Invoices/Payments — the
final legs of the Lead → ... → Invoice → Payment workflow chain):
- **Subcontractors** (part of module 5's domain, db/migrations/0005) —
  CRUD, mirrors Suppliers exactly (same status list, same shape). No
  dedicated `subcontractor.*` permission exists in
  `db/migrations/0016`'s seed, so — same as Suppliers — its endpoints
  reuse `purchase_order.*`.
- **Progress Claims** (module 8) — client and subcontractor claims
  against a project, decided through the shared approval engine
  (`'claim'` is a valid `approval_workflows.module` value). Per-line
  `currentPercent`/`amount` are supplied by the preparer, not derived —
  `claim_items.contract_quantity` has no unit-rate column beside it, and
  a subcontractor claim's BOQ isn't modeled as a table at all, so there
  is nothing to compute a dollar amount from even for client claims;
  `previousPercent`/`cumulativePercent` (FR-8.3's "running claimed-to-date
  totals") *are* derived, from the most recent certified/paid claim's
  items for the same `quotationItemId`, guarding against exceeding 100%
  cumulative. Certifying a claim creates a `PaymentCertificate`
  (FR-8.7; numbered off the claim's own number — there's no
  `payment_certificate` entry in `document_numbering_sequences`'s
  `CHECK` list) and, when `retentionAmount > 0`, a `RetentionRecord`
  (FR-8.6; held, with no release-date scheduling wired up yet). A
  certified **subcontractor** claim also posts an `actual` cost
  transaction (category `subcontractor`) — a certified client claim
  does not, since client claims are revenue (see Invoices below), not
  project cost. **Flagged, not fixed**: the 100%-cumulative guard only
  checks against the last *certified* claim, so two draft claims
  covering overlapping percentages on the same BOQ line can each
  individually pass validation, and nothing re-checks the cap when the
  second one is certified — documented inline in
  `claims.service.ts`'s `buildItems`.
- **Invoices + Payments** (module 13's invoice/payment half of
  Accounting Integration) — the only invoice creation path is
  `POST /claims/:claimId/invoice` (FR-13.3, "claim → invoice"),
  restricted to certified **client** claims (subcontractor claims never
  reach here — see above). Tax isn't derived (claims carry no linked
  tax code); the preparer supplies it. `recordPayment` uses the same
  atomic-guard shape as `PurchaseOrdersRepository.recordDelivery`'s
  per-line over-receipt guard — a concurrent payment can never push
  `amountPaid` past `total` — and once an invoice reaches `paid`, the
  originating claim is transitioned to `paid` too
  (`ClaimsService.markPaid`, the one piece of cross-module claim-status
  mutation this module performs). No adapter to Xero/QuickBooks exists
  (FR-13.1/13.2/13.4's actual accounting-system sync) — this only
  builds Antech's own invoice/payment bookkeeping, which is what a
  future adapter would export *from*.

**Batch 5** (Procurement/RFQ, Payroll, Document Management, Dashboard —
by explicit request, skipping CRM and the Accounting Integration
adapter for now):
- **Procurement/RFQ** (module 6) — Material/Purchase Requests (a
  single entity backs both, per db/migrations/0005's own header
  comment) with submit/approve via the shared approval engine (module
  `'purchase_request'`); RFQs with items, supplier recipients, response
  recording (per-line `unitPrice × quantity`, summed to `totalAmount`),
  and selecting a winning response (FR-6.3 — no scoring algorithm is
  computed; responses are just exposed for the caller/frontend to rank
  by price or lead time). FR-6.5's inventory reservation is flagged,
  not built — Inventory doesn't exist yet. **Fixed in passing**: PO
  creation already accepted an optional `materialRequestId` link
  (wired since batch 1) with no tenant-ownership check at all — a real
  cross-tenant IDOR gap that simply couldn't be closed before this
  batch, since `MaterialRequest` didn't exist as a queryable entity
  until now. `PurchaseOrdersService.create()` now validates it the same
  way `supplierId`/`projectId` already were.
- **Payroll** (module 12) — periods, statutory contribution rule
  config (CPF/EPF/SOCSO, rate/ceiling by country+scheme), and exports.
  Regular/overtime hours are always read-derived from approved
  Timesheets (FR-12.4 — `TimesheetsRepository.sumApprovedHoursByUser`),
  never accepted as input. Every other figure on a line — allowances,
  deductions, statutory contributions, **net pay** — is required input
  from the caller, not computed: this schema has no wage/salary source
  anywhere (the same gap already flagged for Timesheets' cost-ledger
  wiring), so a "net pay" formula that omitted the wage term would look
  computed while being wrong. An early draft of this module did exactly
  that (defaulted `netPay` to `allowances - deductions - statutory`,
  silently missing the wage component) — caught and fixed before it
  shipped, not after. A CSV export endpoint covers FR-12.3.
- **Document Management** (module 14) — folders (hierarchical,
  project/customer/supplier/company-scoped) and documents with real
  version control (FR-14.2 — a re-upload appends a `DocumentVersion`
  row and repoints `currentVersionId`; it never touches or duplicates
  the prior version). Permission grants/revokes are recorded but **not
  enforced** by the read/download path yet — the only live gate is the
  module-level `document.view` permission, same as everywhere else;
  flagged rather than implying a per-document ACL is actually checked.
  Actual file storage is stubbed (`DocumentStorageService`, same tier
  as `QuotationDeliveryService`) — real S3/MinIO wiring (presigned PUT/GET)
  is deferred to the jobs/integrations batch, even though
  `infra/docker/docker-compose.yml` already provisions a MinIO
  container for it; building a real SDK-backed flow here would mean
  adding a new dependency this session can't verify end-to-end against
  a running instance. `size_bytes` is `BIGINT` in Postgres, which
  Prisma types as JS `bigint` — and `JSON.stringify` throws on
  `bigint` with no native serialization, which would have crashed
  every response containing a document. Converted to `number` at the
  repository boundary instead (safe — no file here will ever approach
  2^53 bytes).
- **Dashboard** (module 1) — nine read-only endpoints: project
  portfolio status (derived — on_track/at_risk/delayed/closed isn't a
  stored column, computed from `plannedEndDate`/`actualEndDate`/status
  against a 14-day at-risk window), outstanding quotations with aging,
  pending approvals routed to the calling user (an `approval_request`
  is "mine" if its current step names me directly or names a role I
  hold — resolved against `user_roles`, not just a naive company-wide
  list), open POs by status, outstanding claims with aging, a
  company-wide costing rollup (`CostingService.getCompanyDashboard`,
  the same shape as the existing per-project dashboard without the
  `projectId` filter), a cash-flow **approximation** (unpaid invoice
  balance as inflow vs. open-PO-total + latest-payroll-net-pay as
  outflow — flagged as an approximation, not a real forecast, since
  POs have no payment-tracking of their own), today's attendance
  headcount, and an audit-log-backed activity feed (FR-1.9's
  notification-feed half is unbuildable — Notifications doesn't
  exist). Every route sits behind one `dashboard.view` permission,
  not a per-widget one — `db/migrations/0016` seeds no finer-grained
  permission, and FR-1.10's role-awareness is treated as a frontend
  concern (different roles render different subsets of the same
  endpoints) rather than the backend gating each widget separately.
  **`DashboardRepository` is a deliberate, documented exception** to
  "a service never imports PrismaClient, only that module's repository
  does": Dashboard owns no table of its own and performs no writes, so
  there's no invariant the repository-per-module rule is protecting in
  this one case, unlike every other module built so far.

### Foundation (used by every module above and every module still to come)

- RBAC: JWT auth guard, permissions guard, `@RequirePermission()`.
- Tenant scoping: every repository method takes `companyId` explicitly
  — there is no code path that queries without it.
- Audit logging: `AuditService`, called explicitly by services at the
  point of mutation (not a generic interceptor — see the docstring in
  `common/audit/audit.service.ts` for why).
- Generic approval workflow engine (`common/approval/`), shared by
  Quotations and Purchase Orders now, and by every other approvable
  module as they're built. Its `decide()` claims the status transition
  atomically — see "Verified" below.
- Document numbering (`common/numbering/`) — atomic, race-safe
  sequence allocation for QT-/PO-/PRJ- etc. numbers.
- Cost category domain (`common/constants/cost-category.ts`) — the
  material/labour/equipment/subcontractor list, defined once and
  shared by Quotations, Purchase Orders, and Project Costing rather
  than redeclared per module.
- Standard error shape, correlation IDs, rate limiting, Prisma schema
  (partial — see below).

### Batch 6 (small additions + one real bug fix, driven by frontend batch 2)

Building real frontend UI against every existing endpoint (apps/web's
"make it fully function" batch) surfaced gaps no amount of backend-only
review had caught, because nothing had ever driven these code paths
end-to-end through a browser before:

- **`GET /customers`, `GET /customers/:id`** (`modules/crm/`) — CRM's
  `CustomersRepository` existed since batch 1 as an internal
  dependency for Quotations/PO/Costing's tenant-ownership checks, but
  had no controller at all — not even a list endpoint. The frontend's
  customer pickers needed one. Still not CRM (module 2): no create,
  edit, delete, leads, opportunities, or contacts.
- **`GET /users`** (`modules/users/`) — same reasoning as `GET
  /users/me` (batch 5): a bare list of `{id, fullName, jobTitle}` for
  "assign to" pickers, no permission gate (same as `/me`), still no
  admin CRUD.
- **`POST /quotations/:id/customer-accept`, `.../customer-reject`**
  (`modules/quotations/`) — `QuotationsService.recordCustomerDecision`.
  A real, pre-existing gap: `convertToProject` has always required
  `status === 'accepted'`, but no endpoint anywhere ever transitioned a
  quotation into that status — `'accepted'` was reachable in the schema
  and in `QuotationStatus`, but not through the API. Uses the same
  atomic-claim (`tryTransitionStatus`) pattern as every other status
  transition in this codebase, and the same "staff records the
  decision on the customer's behalf" modeling as
  `VariationOrdersService.recordClientSignOff` (no client portal
  exists to let a customer act directly). 3 new tests.
- **Fixed a real cost-ledger bug**: `PurchaseOrdersService
  .submitForApproval`'s auto-approve branch (taken when no approval
  workflow is configured) called `updateStatus(..., 'approved')`
  directly and never called `recordCommittedCost()` — only the
  explicit `decide()` approval path did. Any PO that auto-approved
  (the common case for a company with no PO workflow configured) would
  later have its committed cost *released* on delivery without ever
  having been *committed* on approval, silently driving a project's
  "Committed" costing figure negative. Found live, watching a real
  Project Costing dashboard, confirmed against the actual
  `cost_transactions` table via `psql` before fixing — not inferred
  from a code read. Fixed by extracting a shared `approveInternally()`
  helper used by both `submitForApproval`'s auto-approve branch and
  `decide()`, so there is exactly one code path that can move a PO to
  `approved` and it always commits cost. The existing test for the
  auto-approve branch only asserted `updateStatus` was called and never
  checked the cost-ledger side effect, which is exactly why this
  shipped unnoticed in batch 2 — added a regression test asserting
  `costing.record` is called for both `material` and `equipment` on
  auto-approve, matching the explicit-approval test's coverage.
- Re-verified after every change: typecheck, lint, `nest build`, and
  **175/175 tests** (up from 168) — all clean.

### Batch 7 — PDF export with company letterhead (by explicit request)

Real, on-demand PDF generation for the four "sent to an external party"
document types, each stamped with the company's real letterhead:

- **`common/pdf/letterhead.ts`** — shared `drawLetterhead()`. If the
  company has uploaded a real logo/banner image (see below), it's drawn
  verbatim, full-width, at the top of the page — real artwork beats
  anything reconstructed from text fields. Falls back to a plain
  name/address/contact text block when no logo is uploaded yet. Also
  owns `generatePdfBuffer()` and `drawFooter()` (page numbers +
  generated timestamp). **Real bug caught and fixed here**: the footer
  was originally positioned just below the printable margin, which
  pdfkit's `.text()` treats as page overflow regardless of the explicit
  y-coordinate given — it silently spawned two extra blank pages per
  document. Fixed by keeping the footer inside the margin box.
- **`common/pdf/pdf-table.ts`** — a small hand-rolled table renderer
  (pdfkit has no table primitive) shared by all four builders, with
  page-break-and-repeat-header handling.
- **`modules/company/`** (new module) — `GET/PATCH /company/profile`
  (address, phone, email, website — `companies` had none of these
  before, see the schema note below) and `POST/GET /company/logo`. The
  logo is stored as bytes directly on the `companies` row
  (`logo_data`/`logo_mime_type`, `db/migrations/0020`), not through the
  still-stubbed `DocumentStorageService` — real S3/MinIO wiring remains
  deferred to the jobs/integrations batch, and one small image per
  tenant doesn't need that infrastructure. Reuses the `settings.view`/
  `settings.edit` permissions 0016 already seeded but nothing had used
  until now. This is a slice of Settings & RBAC (module 17), not the
  full module — no RBAC admin UI here.
- **`quotation-pdf.service.ts` / `purchase-order-pdf.service.ts` /
  `invoice-pdf.service.ts` / `payment-certificate-pdf.service.ts`** —
  one per module, each a thin class alongside that module's existing
  service (same split as `QuotationDeliveryService`). Reuse each
  module's existing `findOne()` detail shape rather than new queries.
  Invoices have no line-items table of their own (billed as a lump sum
  against a certified claim), so the invoice PDF's itemized breakdown
  is pulled from the linked `Claim.items`. New routes:
  `GET /quotations/:id/pdf`, `GET /purchase-orders/:id/pdf`,
  `GET /invoices/:id/pdf`, `GET /claims/:id/certificate/pdf` (404s if
  the claim hasn't been certified yet — no `PaymentCertificate` row).
- **Permissions**: `quotation.export`/`claim.export` were already
  seeded (0016) but unused until now. `purchase_order.export` and
  `accounting.export` didn't exist — added via `db/migrations/0020`.
- **Real bug found and fixed via this batch, unrelated to PDFs
  directly**: `db:seed`'s "idempotent, safe to re-run" claim was only
  true for entity existence, not permission grants — `role_permissions`
  was populated once at role-creation time and never re-synced, so
  0020's two new permissions never reached the already-seeded Owner
  role (a live 403 on every export route until fixed). `seed.ts` now
  backfills any permission the Owner role is missing on every run, not
  just at creation.
- Frontend: a `DownloadPdfButton` component (`apps/web/src/components/`)
  shared across all four detail pages/modals, plus a new
  `features/settings/pages/CompanyProfilePage.tsx` — see
  apps/web/README.md.
- Verified live: all four PDF endpoints round-tripped through a real
  browser click (not just curl) — confirmed via `read_network_requests`
  (200 OK) and by reading the actual generated PDF bytes back to check
  layout, not just that *a* file downloaded. Re-ran the full suite
  after every fix: typecheck, lint, build, **175/175 tests**.

### Batch 8 — minimal Customer create/edit/delete (by explicit request)

`CustomersController` gained `POST/PATCH/DELETE /customers` (name,
registration number, industry, billing address, status) once the app
had real modules needing real customers, not just the 3 seeded demo
ones. `GET /customers` is now paginated (`PaginatedResult<Customer>`,
same shape as `GET /suppliers`) rather than a bare array — the frontend
picker (`features/shared/api.ts`) was updated to request
`?pageSize=100` and unwrap `.data`, matching how it already calls
`/suppliers`/`/subcontractors`. Still not full CRM (module 2): no
contacts, leads, opportunities, or communications. Reuses
`crm.create`/`crm.edit`/`crm.delete`, already seeded in 0016 but unused
until now. Frontend: `features/customers/` (new), mirrors
`features/suppliers/` exactly. Re-verified: typecheck, lint, build,
**177/177 tests** (up from 175).

### Batch 9 — Import from PDF: digitizing historical Excel/PDF records (by explicit request)

Upload an old quotation/project PDF, extract its text, get a best-guess
at a few fields, review/correct, then create a real Project — nothing
silent, nothing guessed straight into the database:

- **`modules/project-import/`** (new module, deliberately at
  `/project-imports`, not nested under `/projects` — see the doc
  comment on `ProjectImportController` for why: Express/Nest route
  matching is first-registered-wins, not specificity-ranked like React
  Router, so `GET /projects/import` would risk being swallowed by the
  existing `GET /projects/:id`).
  - `POST /project-imports/extract` — multipart PDF upload. Runs
    `pdf-parse` (v2's class-based `PDFParse` API, not the old v1
    default-export function) for real text extraction, stores the
    file's bytes directly on the new `imported_files` row
    (`db/migrations/0022` — same "store the real bytes, not a stub
    reference" reasoning as the company logo, 0020: the entire point of
    this feature is getting old paper actually into the software), and
    returns best-guess suggestions from
    `extract-suggestions.util.ts` — customer (fuzzy-matched against the
    tenant's real customer list), a contract value guess (largest
    currency-formatted number found), a date guess, and a project-name
    suggestion derived from the **filename**, not body text (far more
    predictable than trying to detect a "title" in arbitrary layouts).
    **Nothing is written to `projects` at this step.**
  - `POST /project-imports/:id/confirm` — takes the (possibly
    user-corrected) final values and calls the real, already-validated
    `ProjectsService.create()` — an imported project is an ordinary
    project afterward, not a special-cased row. `ProjectsModule` now
    also exports `ProjectsService` (previously only `ProjectsRepository`
    was exported) so this module can reuse it.
  - `GET /project-imports` (history) and `GET /project-imports/:id/file`
    (streams the original PDF back) round out the module.
  - **Scanned/photographed documents are explicitly out of scope** —
    there's no OCR in this stack. When extracted text is too short to
    guess anything from, the response flags `looksScanned: true` and the
    frontend shows a plain warning instead of pretending to have read a
    document it couldn't.
- Frontend: `features/project-import/pages/ImportProjectPage.tsx` — a
  two-phase page (upload → review-and-correct form with the full
  extracted text shown alongside for manual cross-checking), plus an
  "Import from PDF" entry point on the Projects list and an import
  history table.
- Verified live end-to-end (not just curl): uploaded a real generated
  PDF through the actual browser file input (simulated via the
  DataTransfer API with real PDF bytes, since this environment can't
  drive a native OS file dialog — but the app code path exercised is
  identical to a real user's), confirmed the customer auto-match was
  correct, and confirmed the resulting project (PRJ-0004) was created
  and navigated to correctly. Typecheck, lint, build, **177/177 tests**
  — all clean.

### Batch 10 — User Management + Roles (by explicit request)

`GET /users` and `GET /users/me` predate this batch as picker-only
routes; real admin CRUD is new. No migration needed — `User.isActive`,
`Role`, `Permission`, `RolePermission`, `UserRole` were all already
modeled in Phase 2, just never had an API surface:

- **`UsersController`** gained `GET /users/admin` (full admin list),
  `POST /users` (create — hashes the password with argon2, assigns
  roles in the same nested-create call), `GET /users/:id`,
  `PATCH /users/:id` (fields, role reassignment, activate/deactivate).
  Route order matters within the controller — `/admin` and `/me` are
  literal paths declared *before* `/:id`, for the same
  first-match-wins reason documented on `ProjectImportController`.
  Two hard self-lockout guards: you can't deactivate your own account,
  and you can't strip your own last role.
- **`modules/roles/`** (new module) — `GET /roles` (with permission
  IDs/codes and a user count per role), `GET /roles/permissions` (the
  global catalog, for the create/edit-role checklist),
  `POST /roles`, `PATCH /roles/:id`. The seeded "Owner" role
  (`isSystemRole: true`) can't be edited — renaming it or, worse,
  unchecking its permissions has no recovery path (no "reset access"
  flow exists), so `RolesService.update()` rejects it outright.
- Both reuse `user_management.view/create/edit/delete` — already
  seeded in 0016 ("View/Create/Edit users/roles") but unused until now;
  no new permissions migration needed.
- Frontend: `features/user-management/` (Users tab, Roles tab —
  permission checklist grouped by module), composed into a tabbed
  `/settings` page alongside Company Profile (Settings & RBAC's "RBAC"
  half, finally). `nav-config.tsx`'s `permissionPrefix` now accepts an
  array — the "Settings & RBAC" nav link is reachable via `settings.*`
  *or* `user_management.*`, so a role with only the latter (real access
  to user management, but not company-profile editing) still sees the
  nav entry.
- **Verified live, not just via curl**: created a real "Site
  Supervisor" role scoped to 3 permissions, created a real user
  assigned to it, logged in as that user in a separate session, and
  confirmed both the sidebar (only Dashboard/Projects/Timesheets
  visible) and the Dashboard's own widgets (`Missing required
  permission: dashboard.view` on every section, since that permission
  was deliberately not granted) enforced the restriction correctly —
  the full role → user → login → permission-gating pipeline, working
  end-to-end. Typecheck, lint, build, **182/182 tests** (up from 177).

### Minimal supporting repositories (not full modules)

Quotations, Purchase Orders, and Project Costing all reference
Customers by ID without needing the rest of CRM. Rather than block
this batch on building all of CRM, there's a small **read-focused
repository** — just enough to validate a referenced ID belongs to the
tenant:

- `modules/crm/customers.repository.ts` — no controller, no leads/
  opportunities/contacts/communications yet.
- `modules/users/users.repository.ts` — no admin CRUD (invite,
  deactivate, role assignment) yet; just what Auth needs to look up a
  user and resolve permissions. Gained one real endpoint,
  `GET /users/me`, alongside Phase 6 batch 1 — the frontend shell
  needed a real display name/role for the sidebar, not User
  Management (module 16) starting early.

(Projects was one of these in batch 1 — it's now a full module, see above.)

### Explicitly stubbed, not built

- **PDF generation and email delivery** — `QuotationDeliveryService`
  and `SupplierNotificationService` log a warning and return a fake
  reference. The endpoint contracts (`POST .../send`, `POST .../issue`)
  are real and frontend-integrable now; what happens behind them isn't,
  pending the jobs/integrations infrastructure batch (BullMQ + a PDF
  renderer + SMTP, per docs/phase-3-system-architecture/architecture-overview.md §3).
- **Inventory side-effects of receiving a PO** — FR-5.6 wants a
  delivery to also write to `stock_transactions`. Not built — Inventory
  (module 7) doesn't exist yet (deliberately deferred this batch).
  Flagged inline in `purchase-orders.repository.ts`.

### Deferred, not dropped

**Inventory (module 7), CRM beyond the Customers stub (module 2), and
Accounting Integration's actual Xero/QuickBooks adapter** were
explicitly excluded — Inventory and CRM since batch 2, the adapter as
of this batch — all three by request, not because anything about them
changed. They remain in the SRS/roadmap as-is and are picked up in a
future batch, not removed from the product.

### Not started (remaining modules)

CRM (beyond the stub above), Inventory, Accounting Integration's
actual Xero/QuickBooks adapter (the invoice/payment bookkeeping it
would sync is already built — see batch 4), Reporting, User Management
(admin CRUD), Notifications, Settings (beyond the approval engine
already built).

## Three small additions to the Phase 2 schema

Discovered while implementing and verifying, not part of the original
design pass — all three are additive, backward-compatible migrations:

- **`db/migrations/0017_refresh_tokens.sql`** — refresh-token rotation
  with reuse detection needs server-side state; Phase 2 didn't
  anticipate the specific mechanism.
- **`db/migrations/0018_project_document_numbering.sql`** — adds
  `project` to the document-numbering `CHECK` list so
  `Quotation.convertToProject` can mint a project number from the same
  shared sequence mechanism.
- **`db/migrations/0019_purchase_order_rejected_status.sql`** — adds
  `rejected` to `purchase_orders.status`, a genuine Phase 2 oversight
  the TypeScript compiler caught (see "Verified" below) before it could
  hit a live `CHECK` constraint violation.

## Verified

This was written with no Node.js runtime available, then actually
verified once one was located on the machine (it existed at
`C:\Program Files\nodejs`, just not on the shell's `PATH`). In order:

1. `pnpm install` — clean, 743 packages.
2. `prisma generate` — failed once: `currentRevisionId` was modeled as
   a one-to-one relation without the unique constraint the real SQL
   doesn't have either. Fixed to a correctly-shaped `*`-to-one relation
   in `prisma/schema.prisma`.
3. `tsc --noEmit` — failed once, on a real bug: `purchase-orders.service.ts`
   assumed a `'rejected'` PO status that migration 0005 never defined.
   Fixed via migration `0019` above, not by papering over it in code.
4. `eslint` — clean, zero warnings.
5. `nest build` — clean.
6. `jest` — **33/33 tests passed** across all 5 suites (Auth,
   Quotations × 2, Purchase Orders, Suppliers).
7. Booted the compiled app (`node dist/main.js`) against a deliberately
   fake `DATABASE_URL` — every module in the DI graph initialized and
   every route mapped exactly as designed; it failed only at the
   database-authentication step, which is the expected/correct failure
   point without real Postgres credentials. This caught one real bug:
   `RequestContextService` was a provider inside `AuditModule` but
   never `exported`, so `AuthService` (which injects it directly)
   couldn't resolve it even though `AuditModule` is `@Global()` — fixed
   in `common/audit/audit.module.ts`.

8. **Manual re-diff of `prisma/schema.prisma` against every SQL
   migration it covers**, field by field, done on request as a schema
   review. Found and fixed two more real gaps beyond what the tooling
   above caught: `Customer.ownerUserId` and `Project.projectManagerId`
   are real `ON DELETE SET NULL` foreign keys in the SQL, but neither
   had a Prisma `@relation` modeled — inconsistent with the equivalent
   `Quotation.owner`/`PurchaseOrder.approver`, which did. Not a bug in
   anything built so far (nothing queries through those relations yet),
   but would have silently blocked a future `include: { owner: true }`.
   Also added an explicit warning at the top of `schema.prisma` against
   ever running `prisma migrate dev`/`db push` against it — this file
   doesn't fully replicate the SQL's `CHECK` constraints or every
   index, and Prisma has no way to represent a `CHECK` constraint at
   all, so pushing schema *from* this file toward a real database would
   silently drop real constraints. `prisma db pull` (SQL → this file)
   is the only safe direction, same as already documented, but now
   said loudly enough that it's hard to miss.
9. **Manual adversarial read of `auth.service.ts`**, done on request as
   a module review, tracing through concurrent-request and replay
   scenarios by hand rather than just re-reading the happy path. Found
   and fixed two things: (a) a genuine race condition — two concurrent
   `refresh()` calls presenting the same valid token could both pass
   the reuse checks before either write landed, each minting its own
   "replacement" and leaving one as an untracked orphan token outside
   the rotation chain; fixed by claiming the token atomically
   (`AuthRepository.claimRefreshTokenForRotation`, a conditional
   `updateMany` that only one concurrent caller can win) before minting
   its replacement. (b) `AuthService` was injecting `PrismaService`
   directly for `refresh_tokens`/`login_history` — the one module built
   so far that didn't follow the "a service never imports PrismaClient,
   only that module's repository does" rule this codebase otherwise
   holds to (see `docs/phase-3-system-architecture/folder-structure.md`).
   Extracted `auth.repository.ts`; `AuthService` no longer imports
   Prisma at all. Re-ran the full verification chain (typecheck, lint,
   build, tests, boot smoke test) after both fixes — still clean,
   34/34 tests.

   **Left as a documented tradeoff, not fixed:** login/audit bookkeeping
   (`recordLoginAttempt`, and every `AuditService.record()` call
   elsewhere) is `await`ed inline, so a transient failure writing
   `login_history` or `audit_logs` fails the entire request — including
   one where the credentials were correct and tokens were already
   durably issued. That's fail-closed auditing (nothing succeeds unless
   it's provably logged), which is a legitimate, sometimes
   compliance-required posture — but it trades away availability under
   a flaky audit-log write. Which one Antech actually wants is a product
   decision, not something to guess at silently; flagging it here for
   that decision rather than picking one.
10. **Manual adversarial read of Quotations and Purchase Orders**, done
    on request, tracing concurrent-request scenarios the same way as
    the Auth pass. Found the *same class* of race condition in three
    more places, all fixed:
    - **`ApprovalService.decide()`** (`common/approval/` — shared by
      every approvable module, not just these two): read `status !==
      'pending'`, then an unconditional `update()` later. Two
      concurrent decisions on the same request — two approvers racing,
      or a double-click — could both pass the check and last-write-wins
      would silently pick an outcome while both callers believed their
      own decision took effect. This is the most consequential of the
      three, since it's the one every future approvable module
      inherits automatically. Fixed with the same atomic-claim pattern
      as the Auth refresh-token fix (a guarded `updateMany`); added
      `approval.service.spec.ts`, which didn't exist before (it had
      only ever been tested indirectly through Quotations/PO mocks).
    - **`submitForApproval`** in both `QuotationsService` and
      `PurchaseOrdersService`: read `status !== 'draft'`, then an
      unconditional `approval.start()` (a fresh `INSERT`). Two
      concurrent submits on the same draft could each open their own
      `approval_request` row — the older one orphaned forever, since
      `getOpenRequestForEntity` only ever returns the newest. Fixed by
      claiming the `draft` → `pending_approval` transition atomically
      (`tryTransitionStatus`, added to both repositories) before
      calling `approval.start()`.
    - **`PurchaseOrdersRepository.recordDelivery()`**'s over-receipt
      guard: read `quantityReceived` once at the top of the
      transaction, validated against that snapshot, then incremented —
      but Prisma's interactive transactions run at Postgres's default
      Read Committed isolation, so that read isn't a stable snapshot.
      Two concurrent deliveries against the same line could each read
      "40 of 100 received, I can add 60" and both proceed, jointly
      over-receiving to 160. Fixed by folding the guard into the
      increment itself — one atomic `updateMany` per line with
      `quantityReceived: { lte: <remaining outstanding> }` in the same
      call as the `increment`, so the check runs against the row's
      state at write time, not a stale read.

    Re-verified after all three fixes: typecheck, lint, build, 48/48
    tests (added coverage for every new race-guard branch), and the
    boot smoke test — all clean. One thing checked and confirmed
    already-safe, not fixed because it needed no fixing: concurrent
    `addRevision` calls on the same quotation are already caught
    cleanly by the DB's own `UNIQUE (quotation_id, revision_number)`
    constraint (a 409, not silent corruption) — not every race needs an
    application-level guard when the schema already provides one.

11. **Batch 2 (Project Management, Project Costing, PO-as-cost-producer)**,
    verified with the same rigor as batch 1 rather than assumed clean
    because the pattern was already established:
    - `prisma generate` failed once on a schema edit: Prisma doesn't
      support `/* */` block comments (only `//`), and a JSDoc-style
      comment above the `CostTransaction` model broke parsing. Fixed.
    - `tsc --noEmit` failed twice on the same real issue in two
      repositories: `Project.update()` and `ProjectTask.updateTask()`/
      `ProjectIssue.updateIssue()` were typed against Prisma's
      `*UpdateInput` (relation-connect syntax only), but the actual
      calls pass raw scalar FK fields (`projectManagerId`,
      `assigneeUserId`, `assignedTo`) the way every other repository in
      this codebase already does. Fixed by switching to
      `*UncheckedUpdateInput`, consistent with `PurchaseOrdersRepository`.
    - Consolidated a real duplication rather than let it become a third
      copy: `material/labour/equipment/subcontractor` was already
      independently declared in both Quotations and Purchase Orders;
      Project Costing needed the identical domain a third time. Pulled
      into `common/constants/cost-category.ts`, with the two existing
      declarations now re-exporting from it instead of redeclaring it.
    - Checked, not fixed because it needed no fixing: `ProjectBudget`
      has a real `UNIQUE(project_id)` constraint (db/migrations/0009),
      so two concurrent calls to initialize a project's budget are
      already caught cleanly as a 409 by the database — same pattern
      as the `quotation_revisions` case in batch 1's review.
    - Re-verified after every fix: typecheck, lint, build, and
      **66/66 tests** (up from 48 — new suites for `ProjectsService`,
      `CostingService`, and expanded `PurchaseOrdersService` coverage
      for the new cost-ledger writes), plus the boot smoke test against
      the now-longer module dependency chain
      (`PurchaseOrdersModule → ProjectCostingModule → {ProjectsModule,
      QuotationsModule} → CrmModule`) — resolved cleanly, no cycle.
12. **Manual adversarial read of the PO ↔ Costing wiring specifically**,
    done on request as a review pass, tracing the financial logic
    end-to-end rather than just the concurrency angle already covered
    above. Two findings:
    - **Fixed**: `'cancelled'` has been a valid `purchase_orders.status`
      value since Phase 2, but nothing ever transitioned a PO into it —
      there was no way to cancel one through the API at all. That
      mattered more once approval started committing cost to the
      project ledger: an approved-then-abandoned PO would leave a
      permanent, unreleasable "committed" figure behind. Added
      `PurchaseOrdersService.cancel()`, but **only the safe half** —
      cancelling from `draft`/`pending_approval`, where no cost has
      been committed yet. Cancelling an already `approved`/`issued` PO
      still isn't supported: it would need to release that PO's
      outstanding committed amount per category, which requires
      knowing how much of its original commitment hasn't already been
      released by a delivery — not answerable from the current ledger
      (summed by category + source, not tracked per line) without a new
      query. The method throws a clear, explanatory error for that case
      rather than either silently failing or half-reversing the ledger.
    - **Flagged, not fixed**: `recordDelivery`'s released/actual amounts
      are rounded to 2dp independently on *each* partial delivery
      (`round2(quantityReceived × unitPrice)`). Summing several
      independently-rounded parts doesn't always equal rounding the
      whole once — the classic drift problem — so a line item split
      across many deliveries with an awkward unit price (3+ significant
      decimal digits) could leave the ledger off by a cent or few cents
      from the true total. A correct fix means tracking exact remaining
      value *per line item* across deliveries (release the precise
      remainder on the delivery that completes a line, not an
      independently-rounded partial amount), which the schema doesn't
      currently track at that granularity. Low real-world severity for
      this domain (contractor unit prices are typically round numbers,
      not $10.005/unit) and a genuine structural change to fix properly
      — noted rather than patched partially.
    - Re-verified after the `cancel()` addition: typecheck, lint, build,
      **72/72 tests** (up from 66), and the boot smoke test — all clean.
13. **Batch 3 (Variation Orders, Timesheets/Leave)** — schema, typecheck,
    and lint all passed clean on the first attempt this time (unlike
    batches 1–2, which each caught a real issue on the first run), which
    is itself worth noting rather than assuming it means less scrutiny
    was needed: lint still caught one real unused import
    (`LeaveRequest` in `leave.repository.ts`) before it was fixed.
    Re-verified after: typecheck, lint, build, **99/99 tests** (up from
    72 — new suites for `VariationOrdersService`, `TimesheetsService`,
    `LeaveService`), and the boot smoke test — 74 routes mapped, all
    clean, DB-auth the only expected failure point.

14. **Self-caught before batch 4**: `LeaveService.decide()` was deciding
    leave requests directly rather than through `ApprovalService`,
    reasoned at the time as "`leave_requests` has no
    `approval_workflow_id` column of its own" — true, but equally true
    of Quotations, Purchase Orders, and Variation Orders' own tables,
    none of which store a back-reference either (the generic engine
    links the other way, via `approval_requests.entity_type`/`entity_id`).
    `'leave_request'` is explicitly a valid `approval_workflows.module`
    value (db/migrations/0015), confirming Phase 2 *did* design leave
    to go through the shared engine the same as everything else. Fixed
    before Progress Claims — the next approvable module — could repeat
    the same reasoning error; `createLeaveRequest` now opens the
    approval request itself (leave has no separate draft/submit step,
    so creation plays the role `submitForApproval` plays elsewhere).
    Re-verified: typecheck, lint, **101/101 tests** (up from 99) — clean.

15. **Batch 4 (Subcontractors, Progress Claims, Invoices/Payments)** —
    same rigor as every prior batch:
    - `tsc --noEmit` failed twice on real issues: `CostingService.record()`'s
      `sourceType` doesn't accept a free-form `'claim'` string — the
      `cost_transactions.source_type` `CHECK` (db/migrations/0009)
      already anticipated this exact case with `'subcontractor_claim'`,
      which is what got used instead of loosening the type. Separately,
      a `previousPercent && repository.get(...)  ?? 0` expression in
      `buildItems` inferred a `string | number` union from the `&&`
      short-circuit instead of the intended `number` — rewritten as an
      explicit ternary.
    - Self-caught on re-read before moving to the next task: the
      `submitForApproval` → `under_review` transition was written using
      `tryTransitionStatus` (the atomic-claim helper) without checking
      its return value — the exact anti-pattern batch 1's Auth/Quotations/PO
      review (§10 above) fixed everywhere else, reintroduced by copying
      the shape without the reasoning. On inspection the transition is
      provably race-free at that point (nothing else can move a claim
      off `'submitted'` between the atomic `draft`→`submitted` claim
      earlier in the same method and this line), so it was switched to
      a plain `updateStatus` call instead of a silently-ignored
      `tryTransitionStatus` — consistent with why `VariationOrdersService
      .requestClientSignOff` also uses plain `updateStatus`.
    - Checked, not fixed because it needed no fixing: `Invoice`'s
      `recordPayment` atomic guard (`amountPaid: { lte: ... }` folded
      into the increment, `count === 0` on a lost race) was written
      directly against the already-established `recordDelivery` pattern
      from batch 1, not discovered as a bug afterward — the review here
      was confirming the transplant was faithful, which it was.
    - Re-verified after every fix: typecheck, lint, build,
      **128/128 tests** (up from 101 — new suites for
      `SubcontractorsService`, `ClaimsService`, `InvoicesService`), and
      the boot smoke test — all routes mapped including
      `/api/v1/subcontractors`, `/api/v1/claims`, `/api/v1/invoices`,
      and `/api/v1/claims/:claimId/invoice`; DB-auth the only expected
      failure point.

16. **Batch 5 (Procurement/RFQ, Payroll, Document Management,
    Dashboard)** — same rigor as every prior batch:
    - `tsc --noEmit` was clean on the first attempt for the schema and
      every module's own code. The one real defect this batch caught
      was found on self-review before shipping, not by the compiler:
      `PayrollService.generateExport` originally defaulted `netPay` to
      `allowances - deductions - statutoryEmployeeContribution` when
      the caller omitted it — a formula that silently drops the wage
      term this schema has no source for at all, so it would have
      *looked* like a real computed net pay while being wrong on every
      line. Fixed by making `netPay` required input, never derived —
      see `PayrollExportLineInputDto`'s doc comment. The same
      self-review also caught `payroll_export_lines` having no
      `UNIQUE(payroll_export_id, user_id)` in `db/migrations/0010`,
      meaning nothing would have stopped the same employee appearing
      twice in one export and silently double-counting their pay;
      added an application-level guard for it.
    - **Fixed a real cross-tenant gap that predates this batch**:
      `PurchaseOrdersService.create()` has accepted an optional
      `materialRequestId` since batch 1 with no tenant-ownership check
      at all — because `MaterialRequest` wasn't a queryable Prisma
      model until this batch built Procurement. Now validated the same
      way `supplierId`/`projectId` already were. Not something batch 1
      could have caught (there was nothing to check against yet), but
      worth naming as a real IDOR-shaped gap rather than filing it
      under "new feature."
    - Checked, not fixed because it needed no fixing: `RfqsRepository
      .selectResponse`'s atomic guard (`status: { not: 'closed' }`
      folded into the same update, `count === 0` on a lost race) was
      written directly against the already-established
      `InvoicesRepository.recordPayment`/`PurchaseOrdersRepository
      .recordDelivery` shape from earlier batches, not discovered as a
      gap afterward.
    - `DashboardRepository` reaching into `PrismaService` directly
      (every other repository in this codebase owns exactly one
      table) is a deliberate, documented exception — see
      apps/api/README.md's batch 5 section above — not an oversight;
      called out here so it doesn't read as one on a future audit.
    - Re-verified after every fix: typecheck, lint, build,
      **166/166 tests** (up from 128 — new suites for
      `MaterialRequestsService`, `RfqsService`, `PayrollService`,
      `DocumentsService`, `DashboardService`), and the boot smoke
      test — every route mapped, including
      `/api/v1/material-requests`, `/api/v1/rfqs`,
      `/api/v1/payroll/periods`, `/api/v1/documents`, and
      `/api/v1/dashboard/*`; DB-auth the only expected failure point.
17. **`GET /users/me`**, added alongside Phase 6 batch 1 (the frontend
    shell's sidebar needed a real display name/role — see
    apps/web/README.md). Typecheck, lint, **168/168 tests** (up from
    166), build, and boot smoke test — `/api/v1/users/me` mapped,
    all clean.

18. **Closed the long-standing "not verified against a live database"
    gap.** The pre-existing PostgreSQL 17 install on this machine still
    isn't usable (no credentials for it, and it's not this project's
    database anyway) — instead, initialized a *second*, separate
    cluster from the same already-installed binaries (`initdb` against
    a fresh data directory, port 5433, its own `antech`/scram-sha-256
    credentials), so nothing about the pre-existing instance was
    touched. Real results, not just DI-graph inference:
    - `db/migrations/apply.sh` — all 19 migrations applied cleanly
      against a real, empty database; **88 tables** created, matching
      the ~87 the docs already claimed.
    - `prisma generate` against this real database, then the compiled
      app actually stayed up (`Nest application successfully started`
      — every previous "boot smoke test" in this log stopped at
      `P1000`, since none of them had real DB credentials to get
      further than that).
    - `POST /auth/login` with a seeded user — real JWT issued, real
      `refresh_tokens` row, real `login_history`/`audit_logs` rows
      written. `GET /users/me`, `GET /dashboard/portfolio`,
      `GET /dashboard/activity` — all round-tripped through Prisma into
      Postgres and back correctly, first time this claim has ever been
      true for this project.
    - Added `src/database/seed/seed.ts` (`pnpm db:seed`) — creates one
      company, one "Owner" role granted every seeded permission, and
      one user. Stands in for the "new company" bootstrap flow that
      still doesn't exist as an API endpoint (see "Not started" above)
      — deliberately a script, not a public route, since a real
      signup/verification flow is a different, unbuilt thing.
    - Port 3000 being occupied by the unrelated process
      apps/web/README.md flagged turned out to matter here too — the
      real API now runs on **3001** for local dev instead (see
      `.env`, not `.env.example`, which still documents 3000 as the
      normal/production default).
    - Re-ran the full suite against this real setup for good measure:
      typecheck, lint, **168/168 tests**, build — all still clean.

## Running

```bash
cp ../../.env.example ../../.env   # fill in real secrets
pnpm install
pnpm prisma:generate
bash ../../db/migrations/apply.sh  # requires DATABASE_URL exported
pnpm db:seed                       # creates a company + Owner user — see console output for credentials
pnpm start:dev
```

API listens on `API_PORT` (`.env.example` defaults to `3000`) under the
`/api/v1` prefix; Swagger UI at `/api/docs` outside production. This
session's own local Postgres is on a separate, non-default port (3001
for the API, 5433 for Postgres) — see item 18 above for why.
