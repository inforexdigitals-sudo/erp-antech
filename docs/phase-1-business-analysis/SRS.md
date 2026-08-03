# Software Requirements Specification (SRS)
## Antech ERP — Cloud-Based ERP Platform for Engineering Contractors

**Version:** 1.0 (Draft for approval)
**Status:** Phase 1 — Business Analysis
**Date:** 2026-07-31

---

## 1. Introduction

### 1.1 Purpose
This document defines the business and functional scope of Antech ERP, a lightweight,
cloud-based ERP platform purpose-built for small and medium engineering contractors. It
is the foundation for all subsequent design phases (database design, system architecture,
UI wireframes, backend/frontend implementation). No code or schema is written until this
document is approved.

### 1.2 Product Vision
Replace the mix of spreadsheets, email threads, and disconnected point tools that
engineering contractors currently use to run projects, with a single, fast, secure
system covering the full lifecycle from **lead → quotation → project execution →
procurement → claims → invoicing → project close**.

### 1.3 Competitive Positioning
| Competitor | What we take | What we deliberately drop |
|---|---|---|
| Procore | Field/project execution rigor | Enterprise price tag, bloated UI |
| Buildertrend | Client-facing workflow simplicity | Residential-only focus |
| Buildxact | Fast estimating/quoting UX | Limited procurement/costing depth |
| Odoo | Modular, ERP-wide data model | General-purpose complexity, slow UI |
| Primavera P6 | Rigorous cost/schedule control | Steep learning curve, desktop-era UX |

Antech ERP's wedge: **contractor-specific workflow (quote → PO → claim → variation),
sub-second UI, and a clean single dashboard**, at SMB price and complexity.

### 1.4 Definitions & Abbreviations
| Term | Meaning |
|---|---|
| RFQ | Request for Quotation (to suppliers) |
| PO | Purchase Order |
| VO | Variation Order |
| BOQ | Bill of Quantities |
| QS | Quantity Surveyor |
| RBAC | Role-Based Access Control |
| Tenant | An isolated company instance in the multi-tenant model |
| Retention | Percentage withheld from claims until defects liability period ends |
| WIP | Work in Progress (costing) |

---

## 2. Scope

### 2.1 In Scope (V1)
All 18 modules listed in section 5, single-tenant deployment (architected for
multi-tenant later), web application (responsive, mobile-friendly), REST API,
role-based access control, document management, reporting/export, and integration
**stubs** for accounting/payroll (Xero/QuickBooks first; others as adapters).

### 2.2 Out of Scope (V1 — candidate for later phases)
- Native mobile apps (iOS/Android) — V1 ships as a responsive PWA-friendly web app instead.
- Full GraphQL API (REST first; GraphQL layer is architected for but not built in V1).
- SMS/WhatsApp notification delivery (interfaces stubbed; provider wiring deferred).
- Multi-tenant billing/subscription management (schema supports it; no billing UI in V1).
- Deep BIM/CAD file viewers (documents are stored/versioned, not rendered/annotated).
- Power BI live connector (Excel/PDF/CSV export ships first; API-based BI is V2).

### 2.3 Deployment Model
- V1: single company (single tenant), cloud-hosted, Docker-based.
- Data model and auth model designed from day one so a `company_id` (tenant) scope
  can be enforced platform-wide, enabling multi-tenant SaaS later without a rewrite.

---

## 3. Stakeholders & User Roles

### 3.1 Roles (initial RBAC role list)
| Role | Primary concerns |
|---|---|
| Company Owner / Managing Director | Company-wide visibility, profitability, approvals |
| Project Manager | Project delivery, budget, schedule, team |
| Project Engineer | Technical execution, drawings, site issues |
| Site Supervisor | Daily site reports, attendance, material issue |
| Quantity Surveyor | BOQ, claims, variations, cost control |
| Procurement Officer | RFQ, vendor comparison, PO issuance |
| Store Keeper | Inventory, stock movement, receiving |
| Accounts | Invoicing, payments, accounting integration |
| HR | Employee records, leave, onboarding |
| Payroll | Payroll export, statutory contributions |
| Employee | Timesheets, leave requests, personal profile |
| Client (external, portal access) | Quotation approval, claim approval, project visibility |
| Supplier (external, portal access) | RFQ response, PO acknowledgement, delivery status |
| Subcontractor (external, portal access) | Claims submission, document exchange |
| System Administrator | User management, settings, audit logs, security |

Each role maps to a **permission set** (module × action: view/create/edit/delete/approve),
configurable per company in Settings → User Management (module 16).

### 3.2 Personas (representative, drives UX priorities)
1. **Owner (Michael)** — checks the dashboard on his phone each morning; cares about
   cash flow, project profitability, and outstanding approvals. Needs speed, not depth.
2. **QS (Priya)** — lives in quotations, BOQs, and claims all day; needs fast data
   entry, revision history, and accurate calculations — zero tolerance for slow forms.
3. **Site Supervisor (Ah Kow)** — uses a phone on site with patchy signal; needs a
   lightweight mobile view for daily reports, photos, and material issue/attendance.
4. **Procurement Officer (Farah)** — compares supplier quotes and issues POs; needs
   side-by-side comparison views and fast approval routing.
5. **Accounts (Wei Ling)** — reconciles claims/invoices against the accounting system;
   needs accurate exports and clear audit trails.

---

## 4. End-to-End Workflow (System Backbone)

```
Lead → Quotation → Approval → Project → Procurement → Purchase Order →
Material Delivery → Site Work → Timesheet → Progress Claim → Variation Order →
Invoice → Payment → Project Close
```

This workflow is the spine of the data model: a **Lead** converts to a **Quotation**;
an approved Quotation converts to a **Project**; a Project drives **Procurement/PO**,
**Timesheets**, **Progress Claims**, and **Variation Orders**; claims and variations
roll up into **Invoices**; payments close the financial loop; project status moves to
**Closed** once all claims are certified and paid (or written off) and retention is
released.

Every stage-transition is logged (audit log, module 16) and most are gated by an
**approval workflow** (configurable per module in Settings → Approval Workflow, module 18).

---

## 5. Module Breakdown — Functional Requirements

Each module below lists its core entities and functional requirements (FR). Detailed
field-level data dictionaries are produced in **Phase 2 (Database Design)**.

### 5.1 Dashboard
- FR-1.1 Show project portfolio status (on-track / at-risk / delayed / closed) with drill-down.
- FR-1.2 Show outstanding quotations (count, value, aging).
- FR-1.3 Show pending approvals across all modules, routed to the logged-in user.
- FR-1.4 Show open POs and procurement status (requested/approved/ordered/delivered).
- FR-1.5 Show outstanding claims (client + subcontractor) and aging.
- FR-1.6 Show project profitability summary (budget vs. actual vs. forecast) per project and company-wide.
- FR-1.7 Show cash flow summary (inflows from claims/invoices vs. outflows to POs/payroll).
- FR-1.8 Show today's employee attendance snapshot.
- FR-1.9 Show notification feed and recent activity feed (audit-log-backed).
- FR-1.10 Dashboard widgets are role-aware — a Site Supervisor sees a different default view than an Owner.
- FR-1.11 Dashboard must load in under 1.5s on broadband and remain usable on 3G.

### 5.2 CRM
- FR-2.1 Manage Customers (companies) and Contacts (people), many-to-many.
- FR-2.2 Manage Leads with source, stage, owner, and expected value.
- FR-2.3 Manage Opportunities with pipeline stages, convertible to Quotation.
- FR-2.4 Log communication history (calls, emails, meetings) per customer/lead/project.
- FR-2.5 Attach/store documents per customer/lead/project (delegates to Document Management, module 14).
- FR-2.6 Link a Project to its originating Customer/Lead for full traceability.

### 5.3 Quotation Management
- FR-3.1 Create quotations from an item library (materials + labour + equipment).
- FR-3.2 Support quotation revisions with full revision history (immutable prior versions).
- FR-3.3 Apply markup, discounts, and taxes at line-item and quotation level.
- FR-3.4 Generate a branded PDF and email it to the customer from within the app.
- FR-3.5 Configurable approval workflow before a quotation is sent externally.
- FR-3.6 Customer-facing approval (portal or emailed link) with e-signature-style acceptance capture.
- FR-3.7 One-click conversion of an approved quotation into a Project (carries BOQ, pricing, and customer data across).
- FR-3.8 Quotation item library is reusable across quotations and seeds Project Costing budgets.

### 5.4 Project Management
- FR-4.1 Project record carries schedule (timeline, milestones, tasks), status, and team assignments.
- FR-4.2 Gantt-style or milestone-based project timeline with dependencies (V1: milestone/task list; full Gantt is a fast-follow).
- FR-4.3 Daily site progress reports with photo attachments, submitted from mobile.
- FR-4.4 Drawing and document register per project (versioned, permissioned).
- FR-4.5 Issue tracking (site issues/snags) with status, assignee, and resolution log.
- FR-4.6 Project calendar aggregating milestones, deliveries, and claim due dates.

### 5.5 Purchase Orders
- FR-5.1 Supplier database with contact, category, and performance history.
- FR-5.2 RFQ creation and dispatch to one or more suppliers; capture supplier responses.
- FR-5.3 Purchase Requests (internal) that route through approval before becoming a PO.
- FR-5.4 PO generation (from approved PR or directly), with line items tied to Project Costing.
- FR-5.5 Support partial deliveries against a single PO with delivery status per line.
- FR-5.6 Receiving workflow updates Inventory (module 7) and Project Costing (module 10) automatically.
- FR-5.7 File attachments (quotes, T&Cs) per PO.
- FR-5.8 Configurable approval workflow by PO value threshold.
- FR-5.9 Email PO directly to supplier from the app; track sent/viewed/acknowledged status.

### 5.6 Procurement
- FR-6.1 Consolidate material requests raised from Projects/Inventory into a procurement queue.
- FR-6.2 Vendor and quotation comparison view (side-by-side, per material/service).
- FR-6.3 System-suggested purchase recommendation based on price, lead time, and vendor rating.
- FR-6.4 Approval workflow distinct from PO approval (procurement decision vs. financial commitment).
- FR-6.5 Inventory reservation against approved procurement to prevent double-allocation.
- FR-6.6 Delivery schedule view across all open procurement, filterable by project/date.

### 5.7 Inventory
- FR-7.1 Multi-warehouse/site stock locations.
- FR-7.2 Material Issue (to project/site) and Material Return (from site) transactions.
- FR-7.3 Stock Transfer between warehouses/sites.
- FR-7.4 Stock Adjustment (with reason code and approval) for reconciliation.
- FR-7.5 Low-stock alerts based on configurable reorder points per item.
- FR-7.6 Barcode/QR code generation and scan-based lookup for stock movements (mobile camera scan).
- FR-7.7 Full stock ledger (transaction history) per item per location.

### 5.8 Progress Claims
- FR-8.1 Client progress claims computed from claimable BOQ percentage-complete.
- FR-8.2 Subcontractor claims submitted against subcontract BOQ, routed for QS review.
- FR-8.3 Claim percentage entry per BOQ line with running claimed-to-date totals.
- FR-8.4 Full claim history/versioning per claim cycle.
- FR-8.5 Supporting document attachment (photos, measurement sheets) per claim.
- FR-8.6 Retention calculation (configurable %) held back and tracked separately per project.
- FR-8.7 Payment certificate generation (PDF) once a claim is certified.
- FR-8.8 Claim summary/status report across all projects.

### 5.9 Variation Orders
- FR-9.1 Raise a Variation Request against a project, linked to originating cause (client instruction, site condition, design change).
- FR-9.2 Approval workflow (internal + client sign-off) before a VO affects budget.
- FR-9.3 Track additional cost (to project budget) and additional revenue (to client contract value) separately.
- FR-9.4 Impact analysis: effect on project budget, margin, and schedule at time of raising.
- FR-9.5 Document tracking (instruction letters, correspondence) per VO.
- FR-9.6 Revision history if a VO is re-priced or re-scoped.
- FR-9.7 Approved VOs automatically update Project Costing (module 10) and claimable BOQ (module 8).

### 5.10 Project Costing
- FR-10.1 Budget captured at project start (from quotation/BOQ), locked as baseline.
- FR-10.2 Actual cost aggregated from POs (received), timesheets (labour), and issued stock (material).
- FR-10.3 Committed cost = approved but not-yet-received POs/subcontracts.
- FR-10.4 Forecast cost = actual + committed + estimate-to-complete.
- FR-10.5 Cost breakdown by category: Material, Labour, Equipment, Subcontractor.
- FR-10.6 Profit analysis: contract value (incl. VOs) vs. forecast cost, live margin %.
- FR-10.7 Cost variance report: budget vs. actual vs. forecast, by category and by project.
- FR-10.8 Real-time costing dashboard per project, refreshed on every relevant transaction (PO receipt, timesheet approval, claim).

### 5.11 Timesheets
- FR-11.1 Daily attendance capture: clock in/out with timestamp.
- FR-11.2 Optional GPS capture on clock in/out for site verification.
- FR-11.3 Project allocation per timesheet entry (an employee can split a day across projects).
- FR-11.4 Overtime calculation based on configurable rules (daily/weekly threshold).
- FR-11.5 Leave request and balance tracking, integrated with attendance calendar.
- FR-11.6 Approval workflow (supervisor → HR) before timesheets feed Payroll/Costing.

### 5.12 Payroll Integration
- FR-12.1 Payroll export summarizing working hours, OT, allowances, and deductions per pay period.
- FR-12.2 Statutory contribution support: CPF (Singapore), EPF/SOCSO (Malaysia) — configurable by country.
- FR-12.3 CSV export in a payroll-provider-friendly format (V1); direct API integration architected as a pluggable adapter (V2+).
- FR-12.4 Payroll data is read-derived from approved Timesheets — no duplicate manual entry.

### 5.13 Accounting Integration
- FR-13.1 Pluggable adapter architecture supporting Xero and QuickBooks first; Odoo/SAP/Dynamics as later adapters.
- FR-13.2 Journal entry export for claims, invoices, and POs.
- FR-13.3 Invoice export (claim → invoice) to the connected accounting system.
- FR-13.4 Payment status sync (pulled back from accounting system where the API supports it).
- FR-13.5 Tax mapping configurable per company (tax codes/rates mapped to accounting system's chart).

### 5.14 Document Management
- FR-14.1 Project-scoped folder structure, extensible to CRM/PO/other modules.
- FR-14.2 Version control on document upload (new upload creates a version, not a duplicate).
- FR-14.3 In-browser preview for common formats (PDF, images; office docs V2).
- FR-14.4 Upload/download with per-folder/per-document permission control (RBAC-aware).
- FR-14.5 Full-text or metadata-based document search.

### 5.15 Reporting
- FR-15.1 Standard report library: Project Profitability, Sales, Purchase, Inventory, Cash Flow, Employee, Payroll.
- FR-15.2 Custom report builder (filter/group/aggregate on core entities) for power users.
- FR-15.3 Excel and PDF export on every report and most list views.
- FR-15.4 API-based access to report data (foundation for a future Power BI connector).
- FR-15.5 All reports respect RBAC — a user only sees data/projects they're permitted to see.

### 5.16 User Management
- FR-16.1 Role-Based Access Control with the role list in section 3.1, customizable per company.
- FR-16.2 Granular permissions: module × action (view/create/edit/delete/approve).
- FR-16.3 Department/team structure for org-aware assignment and reporting.
- FR-16.4 Audit log of all create/update/delete/approve actions, with actor, timestamp, before/after values.
- FR-16.5 Two-Factor Authentication (TOTP-based) available per user, enforceable per role.
- FR-16.6 Login history per user (timestamp, IP, device/user-agent, success/failure).

### 5.17 Notifications
- FR-17.1 In-app notification center (bell icon, unread count, mark-as-read).
- FR-17.2 Email notifications for key events (approvals pending, claim due, PO delivered, etc.), templated (module 18).
- FR-17.3 Pluggable channel adapters for SMS and WhatsApp (interface defined in V1; provider wiring in a later phase).
- FR-17.4 Push notifications for the web app (Web Push API) — V1 for desktop/mobile browser.
- FR-17.5 Per-user notification preferences (which events, which channels).

### 5.18 Settings
- FR-18.1 Company Information (name, logo, registration details, branding for PDFs).
- FR-18.2 Currency configuration (base currency; multi-currency display is a later phase).
- FR-18.3 Tax configuration (tax types, rates, applicability rules).
- FR-18.4 Approval workflow configuration per module (thresholds, approver chains).
- FR-18.5 Document numbering configuration (prefix/sequence per document type: QT-, PO-, VO-, CLM-, INV-).
- FR-18.6 Email template management (for quotations, POs, notifications).
- FR-18.7 Backup status/trigger visibility (actual backup execution is an infra concern, module 9 non-functional).
- FR-18.8 System logs viewer (for admins — surfaces audit log and error events).

---

## 6. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | Dashboard and list views render in < 1.5s (p95) on broadband; API p95 < 300ms for reads |
| Scalability | Stateless application tier; horizontally scalable; DB designed for read-heavy reporting load |
| Availability | Target 99.5% uptime for V1 single-tenant cloud deployment |
| Security | OWASP Top 10 compliant; HTTPS-only; encrypted secrets/passwords at rest; RBAC everywhere |
| Auditability | Every state-changing action is logged with actor, timestamp, and diff |
| Usability | No unnecessary animation; minimal clicks to common actions; mobile-friendly for field roles |
| Accessibility | Keyable navigation, sufficient color contrast in both dark and light themes |
| Data Integrity | Fully normalized relational schema; referential integrity enforced at the DB level |
| Portability | Dockerized; environment-configured (12-factor); cloud-provider agnostic where practical |
| Maintainability | Clean architecture, modular/feature-based code, documented APIs |
| Testability | Unit + integration test coverage on business logic and API contracts; CI-gated |
| Localization readiness | Currency/tax/statutory fields are configurable, not hardcoded, to support SG/MY and future regions |

---

## 7. Assumptions & Constraints

**Assumptions**
- V1 serves a single company; the data model is tenant-aware from day one so multi-tenant SaaS is a configuration/deployment change, not a re-architecture.
- Statutory payroll formats target Singapore (CPF) and Malaysia (EPF/SOCSO) first, given the module list; other regions can be added as configuration.
- Internet connectivity at site is intermittent — mobile views (attendance, site reports, material issue) should tolerate brief offline gaps gracefully (queue-and-sync is a candidate for a later phase; V1 requires connectivity but degrades gracefully with clear error states).
- Users access the system through modern browsers (Chrome, Edge, Safari — last 2 versions); no legacy IE support.

**Constraints**
- No budget/timeline has been specified by the user — the roadmap in section 9 assumes an incremental, phase-gated delivery with approval checkpoints, not a fixed deadline.
- Technology stack is **not yet finalized** — a recommendation with rationale will be presented in **Phase 3 (System Architecture)** for approval, so this document stays implementation-agnostic.

---

## 8. Success Criteria (V1)

- A contractor can run one full project lifecycle (lead → quote → project → PO →
  claim → invoice → close) without leaving the platform or touching a spreadsheet.
- All 18 modules are usable end-to-end by their primary role persona (section 3.2).
- RBAC correctly restricts data visibility by role in every module.
- Every module's list views support server-side search, filter, and pagination at
  production data volumes (thousands of records) without perceptible lag.
- Full audit trail exists for every financial and approval action.

---

## 9. Roadmap Overview (Phase-Gated Delivery)

| Phase | Deliverable | Gate |
|---|---|---|
| 1 | Business Analysis (this document) | **Awaiting your approval** |
| 2 | Database Design (ERD, schema, indexes, relationships, migrations) | Approval required |
| 3 | System Architecture (stack recommendation, folder structure, API architecture, deployment) | Approval required |
| 4 | UI Wireframes (key screens per module, dark/light) | Approval required |
| 5 | Backend APIs (module by module, REST, tested) | Approval required |
| 6 | Frontend (module by module, connected to real APIs) | Approval required |
| 7 | Authentication & Authorization (JWT, RBAC, 2FA, audit log wiring) | Approval required |
| 8 | Testing (unit, integration, E2E for critical workflows) | Approval required |
| 9 | Deployment (Docker, CI/CD, environment setup) | Approval required |
| 10 | Documentation (API docs, admin guide, developer guide) | Approval required |

Each phase produces a concrete, reviewable artifact before the next phase starts —
no big-bang delivery.

---

## 10. Open Questions for You

These don't block Phase 1 approval, but answers will sharpen Phase 2/3 and avoid rework:

1. **Statutory/regional focus** — should V1 prioritize Singapore, Malaysia, or both equally for payroll/tax config?
2. **Accounting system priority** — Xero or QuickBooks first (module 13)?
3. **Hosting preference** — do you have a preferred cloud provider (AWS/Azure/GCP), or should Phase 3 recommend one?
4. **Team/timeline** — is this being built solo (you + me) or with a wider dev team who'll need to onboard from this documentation?

---

## 11. Approval

Please review this SRS. On approval, Phase 2 (Database Design — ERD, normalized
schema, indexes, relationships, migrations) begins. Feel free to request changes to
scope, roles, or module requirements before we proceed.
