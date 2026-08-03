# Entity Relationship Diagrams

Source of truth for exact columns/types/constraints is the SQL in
[`db/migrations/`](../../db/migrations/). These diagrams are grouped by
domain (one giant diagram across ~70 tables would be unreadable) and show
entity relationships with key fields only.

All tenant-scoped tables carry `company_id → companies.id` (omitted below
per-entity for clarity, called out once per diagram).

---

## 1. Core & Identity (RBAC, audit)

```mermaid
erDiagram
    COMPANIES ||--o{ DEPARTMENTS : has
    COMPANIES ||--o{ USERS : employs
    COMPANIES ||--o{ ROLES : defines
    DEPARTMENTS ||--o{ DEPARTMENTS : "parent of"
    DEPARTMENTS ||--o{ USERS : contains
    USERS }o--o{ ROLES : "user_roles"
    ROLES }o--o{ PERMISSIONS : "role_permissions"
    COMPANIES ||--o{ PORTAL_ACCOUNTS : "client/supplier/subcontractor logins"
    COMPANIES ||--o{ AUDIT_LOGS : logs
    USERS ||--o{ AUDIT_LOGS : "actor (nullable)"
    USERS ||--o{ LOGIN_HISTORY : has
    COMPANIES ||--o{ DOCUMENT_NUMBERING_SEQUENCES : configures

    COMPANIES {
        uuid id PK
        text name
        char3 base_currency
        char2 country_code
    }
    USERS {
        uuid id PK
        uuid company_id FK
        uuid department_id FK
        citext email
        text password_hash
        bool two_factor_enabled
    }
    ROLES {
        uuid id PK
        uuid company_id FK
        text name
        bool is_system_role
    }
    PERMISSIONS {
        uuid id PK
        text module
        text action
        text code UK
    }
    PORTAL_ACCOUNTS {
        uuid id PK
        text party_type
        uuid party_id "polymorphic, app-enforced"
    }
```

---

## 2. CRM & Quotation Management

```mermaid
erDiagram
    CUSTOMERS ||--o{ CUSTOMER_CONTACTS : has
    CUSTOMERS ||--o{ LEADS : "source of"
    CUSTOMERS ||--o{ OPPORTUNITIES : has
    LEADS ||--o{ OPPORTUNITIES : converts_to
    CUSTOMERS ||--o{ QUOTATIONS : receives
    LEADS ||--o{ QUOTATIONS : originates
    OPPORTUNITIES ||--o{ QUOTATIONS : originates
    QUOTATIONS ||--o{ QUOTATION_REVISIONS : "has (immutable history)"
    QUOTATIONS }o--|| QUOTATION_REVISIONS : "current_revision_id"
    QUOTATION_REVISIONS ||--o{ QUOTATION_ITEMS : contains
    ITEM_LIBRARY ||--o{ QUOTATION_ITEMS : "priced from"
    QUOTATIONS ||--o{ COMMUNICATIONS : "polymorphic log"

    CUSTOMERS {
        uuid id PK
        text name
        text status
    }
    QUOTATIONS {
        uuid id PK
        text quotation_number UK
        uuid customer_id FK
        uuid current_revision_id FK
        text status
    }
    QUOTATION_REVISIONS {
        uuid id PK
        uuid quotation_id FK
        int revision_number
        numeric total
    }
    QUOTATION_ITEMS {
        uuid id PK
        uuid quotation_revision_id FK
        uuid item_library_id FK
        numeric quantity
        numeric unit_price
    }
    ITEM_LIBRARY {
        uuid id PK
        text category "material/labour/equipment/subcontractor"
        numeric default_unit_cost
        numeric default_unit_price
    }
```

---

## 3. Projects & Documents

```mermaid
erDiagram
    QUOTATIONS ||--o| PROJECTS : "converts to (FR-3.7)"
    CUSTOMERS ||--o{ PROJECTS : contracts
    PROJECTS ||--o{ PROJECT_TEAM_MEMBERS : staffed_by
    PROJECTS ||--o{ PROJECT_MILESTONES : has
    PROJECT_MILESTONES ||--o{ PROJECT_TASKS : breaks_into
    PROJECTS ||--o{ PROJECT_TASKS : has
    PROJECTS ||--o{ SITE_REPORTS : logs
    SITE_REPORTS ||--o{ SITE_REPORT_PHOTOS : includes
    SITE_REPORT_PHOTOS }o--|| DOCUMENTS : references
    PROJECTS ||--o{ PROJECT_ISSUES : tracks
    DOCUMENT_FOLDERS ||--o{ DOCUMENT_FOLDERS : "parent of"
    DOCUMENT_FOLDERS ||--o{ DOCUMENTS : contains
    DOCUMENTS ||--o{ DOCUMENT_VERSIONS : "versioned as"
    DOCUMENTS }o--|| DOCUMENT_VERSIONS : current_version_id
    DOCUMENTS ||--o{ DOCUMENT_PERMISSIONS : "restricted by role/user"

    PROJECTS {
        uuid id PK
        text project_number UK
        uuid customer_id FK
        uuid quotation_id FK
        text status
        numeric contract_value
    }
    DOCUMENTS {
        uuid id PK
        text related_entity_type "polymorphic: project/quotation/po/claim/..."
        uuid related_entity_id
        text storage_key
        uuid current_version_id FK
    }
```

---

## 4. Procurement, Purchase Orders & Inventory

```mermaid
erDiagram
    PROJECTS ||--o{ MATERIAL_REQUESTS : "raised for"
    MATERIAL_REQUESTS ||--o{ MATERIAL_REQUEST_ITEMS : lists
    MATERIAL_REQUESTS ||--o| RFQS : "spawns (procurement review)"
    RFQS ||--o{ RFQ_ITEMS : lists
    RFQS ||--o{ RFQ_RECIPIENTS : "sent to suppliers"
    SUPPLIERS ||--o{ RFQ_RECIPIENTS : receives
    RFQS ||--o{ RFQ_RESPONSES : collects
    SUPPLIERS ||--o{ RFQ_RESPONSES : submits
    RFQ_RESPONSES ||--o{ RFQ_RESPONSE_ITEMS : prices
    MATERIAL_REQUESTS ||--o| PURCHASE_ORDERS : "approved & converted"
    SUPPLIERS ||--o{ PURCHASE_ORDERS : fulfills
    PROJECTS ||--o{ PURCHASE_ORDERS : "charged to"
    PURCHASE_ORDERS ||--o{ PURCHASE_ORDER_ITEMS : lists
    PURCHASE_ORDERS ||--o{ PO_DELIVERIES : "received via"
    PO_DELIVERIES ||--o{ PO_DELIVERY_ITEMS : records
    PURCHASE_ORDER_ITEMS ||--o{ PO_DELIVERY_ITEMS : "partially fulfills"
    WAREHOUSES ||--o{ PO_DELIVERY_ITEMS : "destination stock"
    WAREHOUSES ||--o{ STOCK_LEVELS : holds
    ITEM_LIBRARY ||--o{ STOCK_LEVELS : "tracked per warehouse"
    WAREHOUSES ||--o{ STOCK_TRANSACTIONS : "ledger of"
    WAREHOUSES ||--o{ STOCK_TRANSFERS : "from/to"
    STOCK_TRANSFERS ||--o{ STOCK_TRANSFER_ITEMS : moves
    WAREHOUSES ||--o{ STOCK_ADJUSTMENTS : corrects

    MATERIAL_REQUESTS {
        uuid id PK
        text request_number UK
        uuid project_id FK
        text status "draft..approved..converted_to_po"
    }
    PURCHASE_ORDERS {
        uuid id PK
        text po_number UK
        uuid supplier_id FK
        uuid project_id FK
        text status
        numeric total
    }
    STOCK_TRANSACTIONS {
        uuid id PK
        text transaction_type "receipt/issue/return/transfer/adjustment"
        numeric quantity "signed"
        text reference_type
        uuid reference_id
    }
```

---

## 5. Claims, Variation Orders & Project Costing

```mermaid
erDiagram
    PROJECTS ||--o{ CLAIMS : "billed via"
    CUSTOMERS ||--o{ CLAIMS : "client claim party"
    SUBCONTRACTORS ||--o{ CLAIMS : "subcontractor claim party"
    CLAIMS ||--o{ CLAIM_ITEMS : itemizes
    QUOTATION_ITEMS ||--o{ CLAIM_ITEMS : "BOQ line ref"
    PROJECTS ||--o{ RETENTION_RECORDS : withholds
    CLAIMS ||--o{ RETENTION_RECORDS : generates
    CLAIMS ||--o| PAYMENT_CERTIFICATES : certifies
    PAYMENT_CERTIFICATES }o--o| DOCUMENTS : "PDF"

    PROJECTS ||--o{ VARIATION_ORDERS : amends
    VARIATION_ORDERS ||--o{ VARIATION_ORDER_ITEMS : lists
    VARIATION_ORDERS ||--o{ VARIATION_ORDER_REVISIONS : "revised as"

    PROJECTS ||--o| PROJECT_BUDGETS : "baseline (from quotation)"
    PROJECT_BUDGETS ||--o{ BUDGET_LINES : breaks_into
    PROJECTS ||--o{ COST_TRANSACTIONS : "actual/committed ledger"
    PURCHASE_ORDERS ||--o{ COST_TRANSACTIONS : "sources (material)"
    TIMESHEETS ||--o{ COST_TRANSACTIONS : "sources (labour)"
    CLAIMS ||--o{ COST_TRANSACTIONS : "sources (subcontractor)"
    VARIATION_ORDERS ||--o{ COST_TRANSACTIONS : "sources (budget change)"

    CLAIMS {
        uuid id PK
        text claim_number UK
        text claim_type "client/subcontractor"
        numeric claim_amount
        numeric retention_amount
        text status
    }
    VARIATION_ORDERS {
        uuid id PK
        text vo_number UK
        text cause
        numeric cost_impact
        numeric revenue_impact
    }
    COST_TRANSACTIONS {
        uuid id PK
        text cost_category "material/labour/equipment/subcontractor"
        text transaction_type "committed/actual"
        text source_type
        numeric amount
    }
```

---

## 6. Timesheets & Payroll

```mermaid
erDiagram
    USERS ||--o{ TIMESHEETS : logs
    TIMESHEETS ||--o{ TIMESHEET_ALLOCATIONS : splits_across
    PROJECTS ||--o{ TIMESHEET_ALLOCATIONS : "charged to"
    USERS ||--o{ LEAVE_REQUESTS : requests
    LEAVE_TYPES ||--o{ LEAVE_REQUESTS : categorizes
    USERS ||--o{ LEAVE_BALANCES : has
    LEAVE_TYPES ||--o{ LEAVE_BALANCES : tracks
    COMPANIES ||--o{ PAYROLL_PERIODS : runs
    PAYROLL_PERIODS ||--o{ PAYROLL_EXPORTS : produces
    PAYROLL_EXPORTS ||--o{ PAYROLL_EXPORT_LINES : "per employee"
    USERS ||--o{ PAYROLL_EXPORT_LINES : "derived from approved timesheets/leave"
    COMPANIES ||--o{ STATUTORY_CONTRIBUTION_RULES : "CPF/EPF/SOCSO config"

    TIMESHEETS {
        uuid id PK
        uuid user_id FK
        date work_date UK "with user_id"
        numeric total_hours
        numeric overtime_hours
        text status
    }
    PAYROLL_EXPORT_LINES {
        uuid id PK
        uuid user_id FK
        numeric regular_hours
        numeric statutory_employee_contribution
        numeric net_pay
    }
```

---

## 7. Accounting Integration, Invoices & Payments

```mermaid
erDiagram
    COMPANIES ||--o{ ACCOUNTING_CONNECTIONS : connects
    ACCOUNTING_CONNECTIONS ||--o{ TAX_MAPPINGS : maps
    TAX_CODES ||--o{ TAX_MAPPINGS : "internal side"
    ACCOUNTING_CONNECTIONS ||--o{ JOURNAL_ENTRY_EXPORTS : syncs
    CLAIMS ||--o{ JOURNAL_ENTRY_EXPORTS : "source (claim)"
    PROJECTS ||--o{ INVOICES : bills
    CLAIMS ||--o| INVOICES : "generates (optional)"
    CUSTOMERS ||--o{ INVOICES : "billed to"
    INVOICES ||--o{ PAYMENTS : receives
    INVOICES ||--o{ JOURNAL_ENTRY_EXPORTS : "source (invoice)"

    INVOICES {
        uuid id PK
        text invoice_number UK
        uuid project_id FK
        uuid claim_id FK
        numeric total
        numeric amount_paid
        text status
    }
```

---

## 8. Settings, Approval Workflow Engine & Notifications

```mermaid
erDiagram
    COMPANIES ||--o{ APPROVAL_WORKFLOWS : configures
    APPROVAL_WORKFLOWS ||--o{ APPROVAL_STEPS : "ordered chain"
    ROLES ||--o{ APPROVAL_STEPS : "approver (role-based)"
    USERS ||--o{ APPROVAL_STEPS : "approver (user-based)"
    APPROVAL_WORKFLOWS ||--o{ APPROVAL_REQUESTS : instantiates
    APPROVAL_REQUESTS ||--o{ APPROVAL_ACTIONS : "decision log"

    COMPANIES ||--o{ TAX_CODES : defines
    COMPANIES ||--o{ EMAIL_TEMPLATES : defines
    COMPANIES ||--o{ COMPANY_SETTINGS : "key-value config"

    USERS ||--o{ NOTIFICATIONS : receives
    PORTAL_ACCOUNTS ||--o{ NOTIFICATIONS : receives
    USERS ||--o{ NOTIFICATION_PREFERENCES : configures
    USERS ||--o{ PUSH_SUBSCRIPTIONS : registers

    APPROVAL_WORKFLOWS {
        uuid id PK
        text module
        numeric min_amount
        numeric max_amount
    }
    APPROVAL_REQUESTS {
        uuid id PK
        text entity_type
        uuid entity_id
        text status
        int current_step_order
    }
```

`approval_requests.entity_type` / `entity_id` is a polymorphic reference
(app-enforced, no native FK) pointing at whichever record — quotation,
purchase_order, variation_order, claim, timesheet, or leave_request —
triggered the workflow.

---

## Full-Text / Fast Search

`pg_trgm` GIN indexes are applied to the columns most likely to be
searched from a list view: `users.full_name`, `customers.name`,
`suppliers.name`, `projects.name`, `item_library.name`,
`documents.file_name` — satisfying the "fast search" non-functional
requirement (NFR, section 6 of the SRS) without a separate search
engine for V1. If full-text relevance search across free-text bodies
(site reports, communications) becomes necessary later, Postgres
`tsvector` columns or an external index (e.g. OpenSearch) can be added
without changing this schema's shape.
