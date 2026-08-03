# Phase 5 — Backend APIs

**Status:** batch 5 of N.

Phase 5 covers 18 backend modules. Building all of them in a single
pass wasn't practical to review carefully, so it lands in batches.
Batch 1 was the technical foundation plus three modules establishing
the pattern (Auth, Quotations, Purchase Orders/Suppliers). Batch 2
added Project Management and Project Costing, and wired Purchase
Orders as a producer into Project Costing's ledger. Batch 3 extends
that producer pattern with Variation Orders (cost on internal approval,
revenue on client sign-off — two distinct moments, not one) and adds
Timesheets/Leave. Batch 4 closes out the rest of the Lead → ... →
Invoice → Payment workflow chain: Subcontractors, Progress Claims (a
fourth module routed through the shared approval engine, and a second
cost-ledger producer alongside Purchase Orders/Variation Orders — only
for subcontractor claims, since client claims are revenue, not cost),
and Invoices/Payments (the local bookkeeping half of module 13; no
Xero/QuickBooks adapter exists yet — see apps/api/README.md). Batch 5
adds Procurement/RFQ (module 6, the one still-missing link feeding
Purchase Orders' `materialRequestId`), Payroll (module 12, hours
read-derived from approved Timesheets, everything else caller-supplied
since there's no wage-rate source anywhere in this schema), Document
Management (module 14, real version control, storage itself stubbed),
and Dashboard (module 1, nine read-only aggregation endpoints). By
explicit request, Inventory, CRM (beyond a minimal Customers stub), and
the Accounting Integration adapter remain skipped — deferred to a
future batch, not dropped from the SRS/roadmap.

Full detail on what's built, what's stubbed, and what's not started
lives in [apps/api/README.md](../../apps/api/README.md) — that file is
the source of truth and will be kept current as later batches land, so
it's linked here rather than duplicated.

## Where the code is

```
apps/api/
  prisma/schema.prisma          partial — 69 models, hand-written (see below)
  src/
    common/                     guards, interceptors, filters, audit, approval engine,
                                 numbering, cost-category domain
    config/                     env-driven typed config
    database/prisma/            PrismaService
    modules/
      auth/                     full
      users/                    read-only repository (Auth's, Payroll's, Documents' dependency)
      crm/                      read-only Customers repository (Quotations/Projects/Costing/VOs/Claims' dependency)
      projects/                 full (module 4)
      project-costing/          full (module 10) — also exposes a company-wide rollup for Dashboard
      quotations/               full
      suppliers/                full
      purchase-orders/          full — a producer into project-costing's ledger
      variation-orders/         full (module 9) — a producer into project-costing's ledger,
                                 and into Project.contractValue on client sign-off
      timesheets/               full (module 11, incl. leave) — NOT a cost-ledger producer,
                                 see apps/api/README.md for why; exposes hour aggregation for Payroll
      subcontractors/           full — mirrors suppliers/
      claims/                   full (module 8) — a producer into project-costing's ledger
                                 (subcontractor claims only), via the shared approval engine
      invoices/                 full (module 13's invoice/payment half) — created only from
                                 certified client claims
      procurement/              full (module 6) — Material/Purchase Requests + RFQ
      payroll/                  full (module 12) — hours read-derived from Timesheets, rest
                                 caller-supplied (no wage-rate source exists in this schema)
      documents/                full (module 14) — real version control, storage stubbed
      dashboard/                full (module 1) — read-only, no table of its own
      health/                   liveness/readiness endpoint
```

## Three schema additions since Phase 2

All additive, all discovered only once implementation (and then
verification) forced the question — see `db/migrations/0017_refresh_tokens.sql`,
`0018_project_document_numbering.sql`, and `0019_purchase_order_rejected_status.sql`
for the reasoning in each file's header comment. None change anything
already built in Phases 1–4. No new migrations were needed for batches
2 or 3 — every table both batches model (`project_milestones` through
`cost_transactions`, `variation_orders` through `variation_order_revisions`,
`timesheets` through `leave_balances`) was already part of the original
Phase 2 SQL (migrations 0004, 0008, 0009, 0010); each batch only added
the Prisma models for tables that already existed. Same for batch 4:
`subcontractors` (0005), `claims` through `payment_certificates` (0007),
and `invoices`/`payments` (0011, its accounting-adapter tables aside)
were all already part of the original Phase 2 SQL. Same for batch 5:
`material_requests` through `rfq_response_items` (0005), `payroll_periods`
through `statutory_contribution_rules` (0010), and `document_folders`
through `site_report_photos` (0012) were all already part of the
original Phase 2 SQL — no new migration needed this batch either.

## What "verified" means for this batch

A Node.js runtime turned out to already be on the machine (just not on
the shell's `PATH`), so every batch gets a real verification pass, not
just careful hand-tracing: `pnpm install`, `prisma generate`, `tsc
--noEmit`, `eslint`, `nest build`, and `jest` all run for real, and the
compiled app is booted to confirm the dependency-injection graph and
route table wire up correctly.

Four rounds of manual adversarial review across batches 1–2 (Auth;
Quotations/Purchase Orders concurrency; the Prisma schema itself;
PO-to-Costing financial logic) consistently found the same *class* of
bug: a status or quantity check read once, then written unconditionally
later, with no guard against another request landing in between —
always fixed with an atomic conditional `updateMany` that only one
concurrent caller can win. The most consequential instance lives in
`common/approval/`, the shared engine every approvable module inherits,
which is why Variation Orders' and Timesheets' `submitForApproval` (and
Timesheets'/Leave's own direct status transitions) already use the same
claim pattern from the moment they were written, not bolted on after a
separate review pass. Batch 3's own schema/typecheck/lint passed clean
on the first attempt — the pattern established across two prior batches
held up, though lint still caught one real unused import before it
shipped. Batch 4 caught the same *class* of lapse in its own new code
before it shipped — a `tryTransitionStatus` call whose return value was
never checked, the exact anti-pattern the batch-1 review fixed
everywhere else — on a self-review pass before moving to the next task,
not by an external reviewer. Batch 5 kept that habit: a self-review
before shipping caught `PayrollService` defaulting `netPay` to a
formula that silently omitted the (nonexistent) wage term — fixed by
requiring it as input instead of ever deriving it — and closed a real
cross-tenant gap that had existed since batch 1 (`PurchaseOrdersService
.create()` accepted a `materialRequestId` with no tenant check,
un-fixable until Procurement gave it something to check against).

Test count: 33 → 48 (batch 1 review) → 66 (batch 2) → 72 (batch 2
review) → 99 (batch 3) → 101 (self-caught Leave/ApprovalService fix,
pre-batch-4) → 128 (batch 4) → 166 (batch 5).

Full chronological account — including several things checked and
confirmed *not* broken (worth knowing, not just the failures), and the
one thing that's still genuinely unverified (a real query against a
live Postgres — this session doesn't have credentials for the instance
that exists on this machine) — is in the "Verified" section of
[apps/api/README.md](../../apps/api/README.md).

## Approving this batch

Approving this batch means: the module pattern (Controller → Service →
Repository → Prisma, tenant-scoped, audited, permission-gated), the
atomic-claim concurrency pattern, and the cross-module producer pattern
(a service injecting another module's service to write into its ledger,
never reaching into its repository directly) are all confirmed as the
shape every remaining module should follow. If something about any of
these should change, now — before it's stamped across the remaining
modules — is the cheap time to say so.
