# Antech ERP Web

React + Vite SPA. See [docs/phase-3-system-architecture/](../../docs/phase-3-system-architecture/)
for the architecture this follows, and [docs/phase-4-ui-wireframes/](../../docs/phase-4-ui-wireframes/)
for the approved visual design this is built against.

## Status: Phase 6, batch 2 of N ("make it fully function")

Batch 1 proved the pattern with one module (Dashboard). Batch 2, done in
response to an explicit "make it fully function" request, builds real
list/detail/create UI for every module that already has a working
backend API — CRM's customer picker aside, that's everything except
Inventory, Reports, and Settings & RBAC, none of which have a backend
yet either (see apps/api/README.md).

### Fully built

- **Foundation** — Vite + React 18 + TypeScript, Tailwind (design tokens
  ported verbatim from `docs/phase-4-ui-wireframes/wireframes.html` as
  CSS variables — same palette, same light/dark behavior, not
  reinvented), TanStack Query, Zustand, React Router.
- **API client** (`lib/api-client.ts`) — matches the real backend
  contract exactly: `AllExceptionsFilter`'s error shape, `paginate()`'s
  list shape, `credentials: 'include'` for the httpOnly refresh cookie.
  Concurrent 401s share one in-flight refresh call rather than each
  firing their own; a response that doesn't match the expected shape
  (e.g. something other than this API sitting on the configured origin)
  still surfaces a message instead of silently rendering nothing — see
  "Verified" below for how that was actually found, not just reasoned
  about.
- **Auth** — Login and 2FA-verify pages wired to the real
  `/auth/login`, `/auth/2fa/verify`, `/auth/refresh`, `/auth/logout`
  endpoints. Access token held in memory only (never localStorage —
  survives an XSS payload reading disk, doesn't survive a hard
  refresh, which is what the refresh-cookie bootstrap on app mount is
  for). Route guards (`ProtectedRoute` / `PublicOnlyRoute`) gate on
  session status, not a hardcoded assumption.
- **AppShell** — sidebar (grouped nav matching the wireframe's icon
  set and grouping, filtered to what the logged-in user's permissions
  actually cover), topbar (search box, theme toggle), responsive
  (overlay sidebar under `lg`). Every nav item routes somewhere; items
  without a built feature yet render a shared `ComingSoon` placeholder
  rather than a dead link.
- **Dashboard** (module 1) — built in batch 1, composing all nine
  `GET /dashboard/*` endpoints: portfolio, outstanding quotations, my
  pending approvals, open procurement, outstanding claims,
  company-wide costing, cash-flow approximation, attendance, activity
  feed. Each section has its own loading/error state (`SectionState`)
  so one slow/failing widget doesn't block the rest of the page.
- **Suppliers / Subcontractors** (module 5's directory half) — list +
  create/edit, identical shape for both (same as the backend, which
  mirrors one onto the other). New `directory_entity` `StatusPill`
  domain (active/inactive/blacklisted), rather than reusing an
  unrelated domain's tone map.
- **Quotations** (module 3) — list, create (with `LineItemsEditor`),
  detail with the full status-gated action bar: submit → approve/reject
  → send → **record customer accept/decline** → convert to project.
  The customer-decision step needed a small real backend addition — see
  below.
- **Projects** (module 4) — list, create, detail with 6 tabs (Overview,
  Team, Milestones, Tasks, Site Reports, Issues, Costing). The Costing
  tab embeds the shared `ProjectCostingPanel`.
- **Procurement & PO** (modules 5/6) — one page composing 5 tabs:
  Purchase Orders (create, full status actions, delivery recording
  against outstanding line quantities), Material Requests, RFQs
  (recipient multi-select, response recording, select-winning-response),
  plus Suppliers/Subcontractors reused as tabs.
- **Progress Claims** (module 8) — list, create (client/subcontractor
  toggle with the matching picker, live retention-% preview), detail
  with submit/certify/reject actions and a "Create Invoice" handoff
  once a client claim is certified.
- **Variation Orders** (module 9) — list, create, detail with the full
  workflow: submit → approve/reject → request client sign-off → record
  client sign-off. Verified end-to-end live against a real project
  (cost/revenue impact computed correctly at every step).
- **Project Costing** (module 10) — the shared `ProjectCostingPanel`
  (budget-vs-actual table, or "initialize from quotation"/"create
  manual budget" when no budget exists yet — a real 404 from the API,
  not an empty state faked on the frontend) plus a standalone
  `/costing` page with a project picker.
- **Invoices & Payments** (module 13) — list, create-from-claim
  (`/invoices/new-from-claim/:claimId`), detail with send/void and a
  record-payment form.
- **Timesheets & Leave** (module 11) — clock in/out widget, per-project
  hour allocation, manual entry, leave types + leave requests.
- **Payroll** (module 12) — periods (create, detail with hours preview
  and per-user allowance/deduction/statutory/net-pay inputs, CSV export
  download), statutory contribution rules.
- **Documents** (module 14) — register (via a real `<input type="file">`
  capturing real fileName/mimeType/sizeBytes — storage itself is
  stubbed server-side, see apps/api/README.md), detail with version
  history and a labeled-as-stub download-URL action.

### Small backend additions this batch

Same discipline as batch 1's `GET /users/me` — added only because the
frontend genuinely couldn't function without them, not scope creep into
the modules they touch:

- **`GET /customers`, `GET /customers/:id`** (`modules/crm/`) — CRM had
  zero API surface before this (not even a list endpoint); Quotations,
  Projects, and Claims all need a customer picker. This is *not* CRM
  (module 2) — no create/edit/delete, no leads/opportunities/contacts.
- **`GET /users`** (`modules/users/`) — mirrors the reasoning for
  `GET /users/me` in batch 1; every "assign to" picker (PO approver,
  project manager, task assignee) needs a name list. Still no admin
  CRUD.
- **`POST /quotations/:id/customer-accept`, `.../customer-reject`**
  (`modules/quotations/`) — a real Phase 5 gap, not new scope: a
  quotation could be submitted, approved, and sent, but nothing ever
  moved it to `'accepted'`, so `convertToProject` (which requires that
  status) was unreachable through the API. Discovered live, in the
  browser, trying to convert a real quotation. `QuotationsService
  .recordCustomerDecision` uses the same atomic-claim pattern as every
  other status transition in this codebase and models the same
  "staff records on the customer's behalf" pattern already established
  by `VariationOrdersService.recordClientSignOff` (no client portal
  exists). Covered by 3 new tests (guard, success, race-loss).

### Explicitly stubbed / deferred

- **CRM (beyond the customer-picker stub), Inventory, Reports, Settings
  & RBAC** — still render `ComingSoon`. No backend exists for any of
  these yet either (see `apps/api/README.md`).
- `shared-types`/`packages/ui-tokens` (planned in
  `docs/phase-3-system-architecture/folder-structure.md`) still weren't
  introduced — response shapes are typed by hand per feature `api.ts`
  file, matching what's actually on the wire.
- **Search** (topbar) — visual only, not wired to anything.
- **Notifications icon** — present in the wireframe's topbar, not
  built here; the Notifications module itself doesn't exist on the
  backend yet either.

## Verified

1. `pnpm install` (workspace-wide) — clean, resolved without needing
   any override.
2. `tsc --noEmit` — clean on the second attempt; the first caught a
   real unused-variable (`hasPermission` destructured in `AppShell`
   but never called — the nav filter uses the raw `permissions` array
   directly instead).
3. `eslint` — clean (one informational warning on `nav-config.tsx`
   about mixing JSX and data exports in one file, which is what that
   file deliberately is — a nav config with inline icon JSX, not a
   component module).
4. `vite build` — failed once for a real reason: `@import` came after
   the `@tailwind` directives in `index.css`, which is invalid CSS
   (`@import` must be the first statement). Fixed by reordering.
5. Ran the dev server and opened it in a real browser (not just
   reasoning about the code): the login page renders correctly in
   dark mode (this machine's OS preference), the CSS variable
   token system works, and the layout measured correctly via
   `getBoundingClientRect()` (centered login card, exact pixel math
   checked, not just "looks right" from a screenshot — a screenshot
   from this session's browser tool turned out to have its own
   scaling quirk that made a *correctly* centered layout look
   top-left in the image; DOM measurement is what actually confirmed
   the CSS was right, not the screenshot).
6. **Found a real bug via this manual test, not code review**:
   submitted the login form against `localhost:3000` and discovered
   an *unrelated* long-running process (uptime ~31 hours, RFC 7807
   `problem+json` error shape — not this project's API, not
   NestJS/class-validator's shape at all) is already bound to that
   port on this machine. Its 401 response body has no `message`
   field, and `ApiError`'s constructor was passing that straight to
   `super()`, so the login page silently showed no error text at all
   — a broken button with zero feedback. Fixed with a fallback message
   (`ApiError`'s constructor) so a response that doesn't match the
   expected shape still tells the user *something* failed, rather than
   assuming every error response will always look like
   `AllExceptionsFilter`'s output.
7. `.claude/launch.json` + `apps/web/run-dev.cmd` exist so this
   session's sandboxed preview tool (which can't resolve `pnpm` on
   `PATH`) can still start the dev server — **not** the intended way
   to run this day-to-day; use `pnpm dev:web` from the repo root (see
   below).

8. **Both caveats above are now closed.** A separate local Postgres
   cluster was stood up (see apps/api/README.md's "Verified" #18 — a
   second, throwaway cluster on port 5433, not touching whatever's
   already on this machine) and the real API now runs on port 3001
   instead of the occupied 3000. Logged in for real
   (`owner@antech.test`, seeded via `pnpm --filter ./apps/api db:seed`)
   through the actual running app in a browser: real JWT issued, real
   session persisted across a hard reload (the silent-refresh-on-mount
   flow doing exactly what it was built for), sidebar nav rendered all
   15 permission-gated items correctly for the seeded Owner role,
   every dashboard section rendered real (empty, since it's a fresh
   database) data with no console errors, `ComingSoon` routing worked,
   and logout correctly cleared the session and redirected to
   `/login`.

   **Found one more real bug this way**: the activity feed's "what
   happened" label was built by naively appending `'d'` to the raw
   action code (`entry.action + 'd'`) — reads fine for `create` →
   "created", but produced `"Priya Ramachandran logind User"` for a
   real login event (`login` → `"logind"`, not "logged in"; several
   other action codes like `certify`/`send` would have been wrong the
   same way). Fixed with an explicit label map covering every action
   code `AuditService.record()` is ever called with
   (`DashboardPage.tsx`'s `ACTION_LABEL`/`describeAction`), falling
   back to the raw code rather than guessing at a suffix for whatever
   gets added next. Re-verified: typecheck, lint — clean.

## Batch 3 — PDF letterhead export (by explicit request)

- **`components/DownloadPdfButton.tsx`** — shared "Download PDF" button
  used on Quotation, Purchase Order, Invoice, and Payment Certificate
  detail views. Fetches the PDF as a Blob (not `apiFetch`'s
  JSON/text-only path) and triggers a browser save via a temporary
  `<a download>` element — the access token lives in memory only, so a
  plain `<a href>`/`<img src>` can never authenticate on its own.
  `lib/api-client.ts` gained `fetchBlob`/`downloadFile`/`uploadFile` for
  this (refactored the retry-on-401 logic into a shared
  `authorizedFetch` all four now use).
- **`features/settings/pages/CompanyProfilePage.tsx`** (new, at
  `/settings`) — address/contact fields plus a real logo upload (drives
  the letterhead on every generated PDF; not full Settings & RBAC,
  module 17 — just this one slice, see apps/api/README.md's Company
  Profile module). The logo preview itself is fetched as a Blob and
  rendered via `URL.createObjectURL`, for the same auth reason as the
  download button.
- Verified live in the browser (not just curl): saved real company
  contact details, then clicked "Download PDF" on a real quotation —
  confirmed via `read_network_requests` (200 OK, zero console errors)
  and by reading the downloaded PDF's actual rendered content.

## Batch 2 ("make it fully function") — Verified

Same rigor as batch 1, extended to a real end-to-end workflow
click-through rather than typecheck/lint/build alone:

1. **Confirmed empirically, not assumed**: every Prisma `Decimal` field
   (money, quantities, hours, percentages, markup/discount/tax
   percentages) serializes over the wire as a JSON **string**, not a
   number — checked directly against live `curl` responses. No global
   interceptor coerces this anywhere in the API. `lib/utils.ts` gained
   `toNumber()`/`formatCurrency()`/`formatNumber()` that all accept
   `string | number | null | undefined` for this reason; every feature
   module types those fields `string` in its `api.ts`, not `number`.
2. `tsc --noEmit` — two real generic-constraint errors, both the same
   shape: `toQueryString<T>` and `LineItemsEditor<T>`'s `T extends
   Record<string, ...>` constraint requires an index signature that
   concrete DTO interfaces don't have. Fixed by constraining to `T
   extends object` instead. `CreateProjectPage`'s `setDescription` was
   declared but never rendered — fixed by adding the missing
   `Description` field rather than deleting the unused setter.
3. `eslint` — clean (0 errors; the same 2 pre-existing informational
   warnings from batch 1, both on files that deliberately mix exports).
4. **Full live browser walkthrough of the core chain against the real
   seeded database** — Quotation (create → submit → auto-approve →
   send → customer-accept → convert-to-project) → Project (budget
   initialized from the linked quotation) → Purchase Order (create →
   submit → auto-approve → issue → deliver) → Progress Claim (create →
   submit → auto-certify, payment certificate generated) → Invoice
   (create-from-claim → send → record-payment) → confirmed the claim
   auto-transitioned to `paid` via `ClaimsService.markPaid`. This is
   what actually found the two backend bugs below — neither was
   visible from typecheck, lint, or the existing test suite.
5. **Found and fixed a real backend bug**: `Quotation` could never
   reach `'accepted'` status at all — see "Small backend additions"
   above (`recordCustomerDecision`).
6. **Found and fixed a real backend bug, the more serious of the two**:
   auto-approving a Purchase Order (the no-workflow-configured path in
   `submitForApproval`) never committed its cost to the project budget
   — only the explicit `decide()` approval path did. Caught by watching
   the Project Costing dashboard show `Committed: -$600` (should have
   floored at `$0`) after a PO was auto-approved then fully delivered;
   confirmed against the real `cost_transactions` table via `psql`
   before fixing, not just inferred from the code. The existing Jest
   test for this path only asserted `updateStatus` was called and never
   checked the cost-ledger write, which is exactly why it shipped in
   batch 2 of the backend without being caught — see
   apps/api/README.md for the fix and the new regression test.
7. Walked Variation Orders (full workflow: submit → auto-approve →
   client sign-off, cost/revenue impact computed correctly at each
   step), Timesheets (clock in/out, leave type + leave request
   creation), Payroll (period creation, detail modal), and Documents
   (list) live in a clean, freshly-authenticated browser tab — no
   console errors on any of them.
8. **One false alarm, run down rather than assumed real**: `read
   _console_messages` surfaced a "change in the order of Hooks" React
   warning for `QuotationDetailPage` mid-session. The component code
   calls every hook unconditionally before its early returns — no Rules
   of Hooks violation. Reloading the same route in a fresh, unedited
   tab produced zero console errors, confirming it was a Vite
   Fast-Refresh artifact from editing the file while it was mounted
   during testing, not a shipped bug. No code change made for this one.
9. `vite build` — clean (`898 kB` main chunk; Vite's routine
   >500 kB code-splitting advisory, not an error — not worth acting on
   at this stage of the app).

## Running

```bash
cp ../../.env.example ../../.env   # fill in real values
pnpm install
pnpm dev:web
```

Dev server listens on `:5173`. Expects the API at `VITE_API_BASE_URL`
(`.env.example` defaults to `http://localhost:3000/api/v1` — this
session's own `.env`, not `.env.example`, points at `3001` instead;
see apps/api/README.md for why).
