# UI Wireframes

**Status:** Phase 4 — proposed for approval.

A clickable HTML prototype, not static images — it's cheaper to feel
whether the density and navigation actually work by clicking through
than by describing it in prose. Open [wireframes.html](wireframes.html)
directly in a browser (no server needed), or view it published at the
artifact link shared in chat.

## Design plan

**Color** — a "blueprint" palette rather than a generic SaaS purple:
deep blueprint-navy ink on a cool off-white ground in light mode,
graphite-navy in dark mode, with a desaturated cyanotype blue
(`#1F5FA8` light / `#6096E3` dark) as the single accent. Status/semantic
color (success/warning/critical) is kept deliberately separate from the
accent hue — a pending-approval pill never fights for attention with the
primary "New Quotation" button.

| Token | Light | Dark |
|---|---|---|
| `--paper` (page bg) | `#F5F6F8` | `#0F131A` |
| `--surface` (cards) | `#FFFFFF` | `#171C25` |
| `--ink` (text) | `#1A2230` | `#E7EBF1` |
| `--accent` | `#1F5FA8` | `#6096E3` |
| `--success` / `--warning` / `--critical` | `#1F7A46` / `#A6660F` / `#B33636` | `#49B57C` / `#E0A550` / `#E27272` |

**Type** — system UI font stack (`-apple-system, "Segoe UI", Roboto, ...`)
throughout, for both headings and body, differentiated by weight and
size rather than a second family. This is a deliberate call, not a
placeholder: it costs zero font-loading time (a real instance of the
product's own "minimal loading time" requirement), and it renders
natively on whatever mix of office desktops, site tablets, and phones
a contractor's team actually uses. Numeric columns use
`font-variant-numeric: tabular-nums` so costs and quantities align.

**Layout** — fixed left sidebar (icon + label, grouped by workflow
stage: Overview / Delivery / Commercials / Workforce / Insight & Admin)
plus a sticky top bar (search, notifications, theme toggle), with
card-based content switched client-side with no page reloads and
essentially no animation beyond a 120–160ms color/transform transition
— consistent with the SRS's explicit "no unnecessary animations."
Below 900px the sidebar becomes an off-canvas overlay behind a
hamburger, and a 4-item bottom tab bar (Home / Projects / Time / Stock)
surfaces the destinations a Site Supervisor or field employee actually
needs one-thumb access to.

## Screens covered

| Screen | Module(s) | What it demonstrates |
|---|---|---|
| Dashboard | 1 | KPI tiles with trend/delta, portfolio status table, pending-approvals queue with inline actions, attendance snapshot, activity feed |
| CRM | 2 | Customer list, opportunity pipeline by stage |
| Quotations | 3 | List + a full builder: line items, markup/discount/tax, revision selector, totals summary |
| Projects | 4 | Milestone progress, team roster, severity-striped issue list |
| Procurement & PO | 5, 6 | Vendor/RFQ comparison table, PO delivery status per line |
| Inventory | 7 | Stock table with reorder-point severity highlighting |
| Progress Claims | 8 | BOQ % complete entry, retention and net-payable summary |
| Variation Orders | 9 | Cost/revenue impact, before/after margin analysis |
| Project Costing | 10 | Budget vs. actual by cost category, committed-budget warning state |
| Timesheets | 11 | Phone-frame mobile clock-in/out with GPS confirmation, supervisor approval queue |
| Reports | 15 | Report library grid with export actions |
| Settings & RBAC | 16, 18 | Generated permission matrix (role × module.action) |

**Not given a dedicated screen:** Payroll (12), Accounting Integration
(13), and Document Management (14) — each is structurally a list/detail
pattern already shown elsewhere (Payroll extends the Timesheets
approval queue; Accounting Integration is a connection-status settings
panel, same shape as the RBAC tab; Documents is the file list already
implied by Projects → Documents). Building a fifth near-identical table
screen wouldn't test anything the prototype hasn't already proven.
Full-fidelity versions of all three land in Phase 6.

## What this prototype is (and isn't) for

It is: a navigable proof of the information density, status-encoding
pattern (pill/stripe/bar, not color alone), and responsive behavior
across desktop, tablet, and the mobile field view. It is not: final
copy, real data, or production markup — Phase 6 rebuilds this against
actual Tailwind + shadcn/ui components and real API data, using this
as the reference rather than a literal template.
