# Schema Data Dictionary

Index of every table: its purpose, its module, and its key relationships.
Column-level types/constraints/defaults are authoritative in the SQL
under [`db/migrations/`](../../db/migrations/) — this dictionary is not
a duplicate of that, it's the map to find your way around it.

**Conventions used throughout every migration:**
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` on every table.
- Every tenant-scoped table carries `company_id → companies.id`.
- `created_at` / `updated_at` (`TIMESTAMPTZ`) on every mutable table; `updated_at` is
  maintained by the shared `set_updated_at()` trigger (defined once, in 0001).
- Soft delete via nullable `deleted_at` on master-data tables that are
  referenced historically (`users`, `customers`, `suppliers`, `subcontractors`) —
  never hard-deleted, since financial/audit history must survive.
- Money: `NUMERIC(18,2)`. Quantities/rates: `NUMERIC(18,4)` or `NUMERIC(5,2)` for percentages.
- Status/category fields are `TEXT` + `CHECK` constraint, not native Postgres `ENUM`
  — adding a new status value is an `ALTER ... DROP/ADD CONSTRAINT`, not a
  type migration that locks the table.
- Every FK column is indexed; composite `(company_id, status)` indexes exist
  on the tables the Dashboard (module 1) queries most.

---

## 0001 — Core & Identity
| Table | Purpose |
|---|---|
| `companies` | Tenant root. Every other tenant-scoped table hangs off this. |
| `departments` | Org units, self-referencing for hierarchy. |
| `users` | Internal staff accounts (all 12 internal roles from SRS §3.1). |
| `roles` | Company-specific RBAC roles (seeded per company at bootstrap; see note below). |
| `permissions` | Global, non-tenant reference list of `module.action` codes. Seeded once (0016). |
| `role_permissions` | Role ↔ permission grants. |
| `user_roles` | User ↔ role assignment (many-to-many — a user can hold multiple roles). |
| `portal_accounts` | External logins for clients/suppliers/subcontractors. `party_type` + `party_id` point at `customers`/`suppliers`/`subcontractors` — polymorphic, enforced at the application layer since Postgres has no cross-table FK. |
| `audit_logs` | Append-only. Every create/update/delete/approve writes here with before/after JSONB. |
| `login_history` | Every login attempt, success or failure, for both `users` and `portal_accounts`. |
| `document_numbering_sequences` | Per-company, per-document-type running counters (`QT-0001`, `PO-0001`, ...). |

> **Note on role seeding:** `roles.company_id` is `NOT NULL` — roles are
> tenant data, not global rows a migration can insert ahead of any
> company existing. The default role set from SRS §3.1 (Owner, PM, QS,
> Procurement Officer, ...) plus their default `role_permissions` are
> created by the application's "new company" bootstrap service, using
> the seeded `permissions` table as its source. This keeps migrations
> pure schema and defers tenant data to app logic — see Phase 3.

## 0002 — CRM (Module 2)
| Table | Purpose |
|---|---|
| `customers` | Client companies. |
| `customer_contacts` | People at a customer. |
| `leads` | Top-of-funnel, optionally linked to an existing customer. |
| `opportunities` | Pipeline stage between lead and quotation. |
| `communications` | Polymorphic call/email/meeting/note log against customer, lead, opportunity, or project. |

## 0003 — Item Library & Quotations (Module 3)
| Table | Purpose |
|---|---|
| `item_library` | The material/labour/equipment/subcontractor catalog. Reused by quotations, procurement, POs, inventory, and costing — priced once, referenced everywhere. |
| `quotations` | Header + status; points at its `current_revision_id`. |
| `quotation_revisions` | Immutable snapshot per revision (FR-3.2) — never edited after creation, only superseded. |
| `quotation_items` | Line items belonging to one revision. |

## 0004 — Projects (Module 4)
| Table | Purpose |
|---|---|
| `projects` | Central workflow entity; optionally born from a `quotation_id` (FR-3.7). |
| `project_team_members` | Who's staffed on the project. |
| `project_milestones` | Schedule anchors. |
| `project_tasks` | Optionally under a milestone. |
| `site_reports` | Daily report per project per submitter. |
| `site_report_photos` | Links a report to `documents` rows (defined in 0012, table created there to avoid a forward FK). |
| `project_issues` | Site issues/snags. |

## 0005 — Suppliers, Procurement & Purchase Orders (Modules 5 & 6)
| Table | Purpose |
|---|---|
| `suppliers` / `supplier_contacts` | Vendor master data. |
| `subcontractors` | Separate master data — subcontractors are claimants (module 8), not PO recipients. |
| `material_requests` / `material_request_items` | **Single entity backing both "material request" (module 6) and "purchase request" (module 5)** — see the header comment in `0005_suppliers_procurement_po.sql` for why these weren't modeled as two records. Status flow: `draft → submitted → under_review → approved/rejected → converted_to_po`. |
| `rfqs` / `rfq_items` / `rfq_recipients` | RFQ sent to one or more suppliers. |
| `rfq_responses` / `rfq_response_items` | Supplier quotes, feeding the vendor-comparison view (FR-6.2). |
| `purchase_orders` / `purchase_order_items` | The financial commitment; optionally sourced from an approved `material_request`. |
| `po_deliveries` / `po_delivery_items` | Partial-delivery receiving (FR-5.5); each delivery item can target a destination `warehouse`. |

## 0006 — Inventory (Module 7)
| Table | Purpose |
|---|---|
| `warehouses` | Central warehouses or per-project `site_store` locations. |
| `stock_levels` | Current on-hand/reserved quantity per item per warehouse — a materialized rollup, kept in sync by the service layer whenever `stock_transactions` is written. |
| `stock_transactions` | **Append-only ledger**, the source of truth for every quantity movement (signed quantity; `receipt/issue/return/transfer_in/transfer_out/adjustment`). `stock_levels` is a cache of this ledger, not an independent fact. |
| `stock_transfers` / `stock_transfer_items` | Warehouse-to-warehouse moves. |
| `stock_adjustments` | Reconciliation entries with reason + optional approval. |

## 0007 — Progress Claims (Module 8)
| Table | Purpose |
|---|---|
| `claims` | Client or subcontractor claim; `claim_type` plus a `CHECK` constraint enforces exactly one of `customer_id`/`subcontractor_id` is set. |
| `claim_items` | Per-BOQ-line percentage complete, optionally tied back to a `quotation_items` row. |
| `retention_records` | Retention withheld per claim, tracked to release. |
| `payment_certificates` | One per claim (`UNIQUE claim_id`), optionally linked to a generated PDF in `documents`. |

## 0008 — Variation Orders (Module 9)
| Table | Purpose |
|---|---|
| `variation_orders` | Cost/revenue/schedule impact, `cause`, and approval status. |
| `variation_order_items` | Priced line items. |
| `variation_order_revisions` | Re-pricing/re-scoping history. |

## 0009 — Project Costing (Module 10)
| Table | Purpose |
|---|---|
| `project_budgets` | One baseline per project (`UNIQUE project_id`), locked via `baseline_locked_at`. |
| `budget_lines` | Budget broken down by cost category. |
| `cost_transactions` | **The real-time actual/committed cost ledger.** Rows are written by the service layer, never entered by hand, whenever a PO is approved/received, a timesheet is approved, or a claim is certified. Budget vs. actual vs. committed vs. forecast (FR-10.1–10.8) are all derived by aggregating this table against `budget_lines` — there is deliberately no separate "actuals" table. |

## 0010 — Timesheets & Payroll (Modules 11 & 12)
| Table | Purpose |
|---|---|
| `timesheets` | One row per user per work date; GPS columns optional. |
| `timesheet_allocations` | Splits a single day's hours across projects. |
| `leave_types` / `leave_requests` / `leave_balances` | Standard leave management. |
| `payroll_periods` / `payroll_exports` / `payroll_export_lines` | Payroll is **derived**, not entered — export lines are computed from approved `timesheets` + `leave_requests` for the period. |
| `statutory_contribution_rules` | Company-configurable CPF (Singapore) / EPF, SOCSO (Malaysia) rate tables by effective date. |

## 0011 — Accounting Integration, Invoices & Payments (Module 13)
| Table | Purpose |
|---|---|
| `accounting_connections` | One row per company per provider (Xero/QuickBooks/Odoo/SAP/Dynamics); tokens encrypted at rest. |
| `tax_mappings` | Internal `tax_codes` ↔ external provider tax code. |
| `journal_entry_exports` | Sync log for claims/invoices/POs pushed to the accounting system. |
| `invoices` | Generated from a certified claim (or standalone); tracks `amount_paid` against `total`. |
| `payments` | Payments received against an invoice. |

## 0012 — Document Management (Module 14)
| Table | Purpose |
|---|---|
| `document_folders` | Optional folder hierarchy, itself polymorphically scoped to a project/customer/supplier/company. |
| `documents` | Polymorphic attachment (`related_entity_type` + `related_entity_id`) usable from any module. |
| `document_versions` | Every upload creates a version (FR-14.2); `documents.current_version_id` points at the latest. |
| `document_permissions` | Per-document view/edit/delete grant to a role or a specific user. |
| `site_report_photos` | Created here (not 0004) to keep the dependency on `documents` one-directional. |

## 0013 — Reporting (Module 15)
| Table | Purpose |
|---|---|
| `saved_reports` | User-defined report definitions (filters/group-by/aggregates as JSONB) — the custom report builder (FR-15.2). Standard reports (profitability, sales, purchase, inventory, cash flow, employee, payroll) are **views/queries**, not tables — they read directly from the transactional schema above. |
| `report_exports` | Audit trail of report exports (PDF/Excel). |

## 0014 — Notifications (Module 17)
| Table | Purpose |
|---|---|
| `notifications` | In-app feed, addressed to a `user` or a `portal_account`. |
| `notification_preferences` | Per-user, per-event-type, per-channel opt-in/out. |
| `push_subscriptions` | Web Push endpoints (FR-17.4). SMS/WhatsApp have no dedicated table — they're delivered through `notifications` + `notification_preferences` via a channel adapter, added when a provider is wired up (Phase 3+). |

## 0015 — Settings & Approval Workflow Engine (Module 18)
| Table | Purpose |
|---|---|
| `tax_codes` | Company tax rates; referenced by `quotation_items.tax_code_id` and `tax_mappings`. |
| `email_templates` | Templated subject/body per event code. |
| `company_settings` | Open-ended key-value config (JSONB value) for settings that don't warrant a dedicated column (retention default %, fiscal year start, etc.). |
| `approval_workflows` | **One generic engine** reused by every module needing approval (quotation, purchase_request, purchase_order, variation_order, claim, timesheet, leave_request) instead of a bespoke approval table per module. Scoped by `module` + optional amount thresholds. |
| `approval_steps` | Ordered approver chain per workflow — role-based or a specific user. |
| `approval_requests` | One instance per entity going through approval; `entity_type`/`entity_id` is polymorphic (app-enforced). |
| `approval_actions` | Decision log (approve/reject + comments) per step. |

## 0016 — Seed Data
Seeds the global `permissions` catalog only (module × action codes).
Per-company roles and role-permission grants are created by application
bootstrap logic on company creation, not by a migration (see the note
under 0001 above).

---

## Cross-Module Design Notes

1. **`item_library` is the single pricing catalog** shared by quotations,
   procurement, POs, inventory, and costing budget lines — pricing a
   material once and reusing it everywhere avoids drift between what
   was quoted, ordered, stocked, and budgeted.
2. **`cost_transactions` and `stock_transactions` are both append-only
   ledgers**, not tables that get updated in place. Anything "real-time"
   (project costing dashboard, stock on-hand) is a derived aggregate over
   a ledger — this is what makes FR-10.8 ("real-time costing dashboard")
   correct by construction rather than by careful manual bookkeeping.
3. **One generic approval engine**, not seven bespoke ones, for every
   module that needs approval routing. Adding an eighth approvable module
   later is a `CHECK` constraint change, not a new set of tables.
4. **Polymorphic references are app-enforced, not FK-enforced**, in a
   handful of deliberately generic tables (`documents`, `communications`,
   `notifications`, `approval_requests`, `document_folders`,
   `portal_accounts`). This is the one place normalization is traded for
   flexibility — documented here so the service layer knows where it
   owns referential integrity instead of the database.
