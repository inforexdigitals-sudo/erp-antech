-- =====================================================================
-- 0005_suppliers_procurement_po.sql
-- Modules 5 (Purchase Orders) and 6 (Procurement)
--
-- material_requests is the single entity backing both "material
-- requests" (module 6) and "purchase requests" (module 5): a request
-- is raised from a project/site, reviewed by Procurement (RFQ + vendor
-- comparison), then approved and converted into a Purchase Order. This
-- avoids duplicating the same request as two records under two names.
-- =====================================================================

CREATE TABLE suppliers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  registration_number TEXT,
  category            TEXT,
  rating              NUMERIC(3,2),
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','blacklisted')),
  payment_terms       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);
CREATE INDEX idx_suppliers_company ON suppliers(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_suppliers_name_trgm ON suppliers USING GIN (name gin_trgm_ops);

CREATE TABLE supplier_contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  email       CITEXT,
  phone       TEXT,
  is_primary  BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_supplier_contacts_supplier ON supplier_contacts(supplier_id);

CREATE TABLE subcontractors (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  registration_number TEXT,
  trade               TEXT,
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','blacklisted')),
  payment_terms       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);
CREATE INDEX idx_subcontractors_company ON subcontractors(company_id) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------
-- Material / Purchase Request (single entity, dual-purpose per header note)
-- ---------------------------------------------------------------------
CREATE TABLE material_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id     UUID NOT NULL REFERENCES projects(id),
  request_number TEXT NOT NULL,
  requested_by   UUID NOT NULL REFERENCES users(id),
  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN
                 ('draft','submitted','under_review','approved','rejected','converted_to_po')),
  needed_by_date DATE,
  notes          TEXT,
  approved_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, request_number)
);
CREATE INDEX idx_material_requests_company_status ON material_requests(company_id, status);
CREATE INDEX idx_material_requests_project ON material_requests(project_id);

CREATE TABLE material_request_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_request_id UUID NOT NULL REFERENCES material_requests(id) ON DELETE CASCADE,
  item_library_id    UUID REFERENCES item_library(id) ON DELETE SET NULL,
  description        TEXT NOT NULL,
  unit               TEXT NOT NULL,
  quantity           NUMERIC(18,4) NOT NULL,
  estimated_unit_cost NUMERIC(18,4),
  notes              TEXT
);
CREATE INDEX idx_material_request_items_request ON material_request_items(material_request_id);

-- ---------------------------------------------------------------------
-- RFQ + vendor/quotation comparison
-- ---------------------------------------------------------------------
CREATE TABLE rfqs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rfq_number          TEXT NOT NULL,
  material_request_id UUID REFERENCES material_requests(id) ON DELETE SET NULL,
  project_id          UUID REFERENCES projects(id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','responses_received','closed')),
  due_date            DATE,
  created_by          UUID NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, rfq_number)
);
CREATE INDEX idx_rfqs_company_status ON rfqs(company_id, status);

CREATE TABLE rfq_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id      UUID NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  item_library_id UUID REFERENCES item_library(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  unit        TEXT NOT NULL,
  quantity    NUMERIC(18,4) NOT NULL
);
CREATE INDEX idx_rfq_items_rfq ON rfq_items(rfq_id);

CREATE TABLE rfq_recipients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id      UUID NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  sent_at     TIMESTAMPTZ,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','viewed','responded','declined')),
  UNIQUE (rfq_id, supplier_id)
);
CREATE INDEX idx_rfq_recipients_supplier ON rfq_recipients(supplier_id);

CREATE TABLE rfq_responses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id       UUID NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  supplier_id  UUID NOT NULL REFERENCES suppliers(id),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_amount NUMERIC(18,2),
  lead_time_days INTEGER,
  notes        TEXT,
  is_selected  BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (rfq_id, supplier_id)
);
CREATE INDEX idx_rfq_responses_rfq ON rfq_responses(rfq_id);

CREATE TABLE rfq_response_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_response_id  UUID NOT NULL REFERENCES rfq_responses(id) ON DELETE CASCADE,
  rfq_item_id      UUID NOT NULL REFERENCES rfq_items(id) ON DELETE CASCADE,
  unit_price       NUMERIC(18,4) NOT NULL,
  quantity         NUMERIC(18,4) NOT NULL,
  line_total       NUMERIC(18,2) NOT NULL
);
CREATE INDEX idx_rfq_response_items_response ON rfq_response_items(rfq_response_id);

-- ---------------------------------------------------------------------
-- Purchase Orders
-- ---------------------------------------------------------------------
CREATE TABLE purchase_orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  po_number           TEXT NOT NULL,
  supplier_id         UUID NOT NULL REFERENCES suppliers(id),
  project_id          UUID NOT NULL REFERENCES projects(id),
  material_request_id UUID REFERENCES material_requests(id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN
                       ('draft','pending_approval','approved','issued','partially_received','received','closed','cancelled')),
  issue_date          DATE,
  expected_delivery_date DATE,
  subtotal            NUMERIC(18,2) NOT NULL DEFAULT 0,
  tax_amount          NUMERIC(18,2) NOT NULL DEFAULT 0,
  total               NUMERIC(18,2) NOT NULL DEFAULT 0,
  payment_terms       TEXT,
  created_by          UUID NOT NULL REFERENCES users(id),
  approved_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, po_number)
);
CREATE INDEX idx_purchase_orders_company_status ON purchase_orders(company_id, status);
CREATE INDEX idx_purchase_orders_project ON purchase_orders(project_id);
CREATE INDEX idx_purchase_orders_supplier ON purchase_orders(supplier_id);

CREATE TABLE purchase_order_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id  UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  item_library_id    UUID REFERENCES item_library(id) ON DELETE SET NULL,
  description        TEXT NOT NULL,
  unit               TEXT NOT NULL,
  quantity           NUMERIC(18,4) NOT NULL,
  unit_price         NUMERIC(18,4) NOT NULL,
  line_total         NUMERIC(18,2) NOT NULL,
  quantity_received  NUMERIC(18,4) NOT NULL DEFAULT 0,
  cost_category      TEXT NOT NULL DEFAULT 'material' CHECK (cost_category IN ('material','labour','equipment','subcontractor'))
);
CREATE INDEX idx_purchase_order_items_po ON purchase_order_items(purchase_order_id);

CREATE TABLE po_deliveries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  delivery_number   TEXT NOT NULL,
  delivery_date     DATE NOT NULL,
  received_by       UUID NOT NULL REFERENCES users(id),
  status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','partial','complete')),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_po_deliveries_po ON po_deliveries(purchase_order_id);

CREATE TABLE po_delivery_items (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_delivery_id           UUID NOT NULL REFERENCES po_deliveries(id) ON DELETE CASCADE,
  purchase_order_item_id   UUID NOT NULL REFERENCES purchase_order_items(id),
  quantity_received        NUMERIC(18,4) NOT NULL,
  warehouse_id              UUID  -- FK added in 0006 once warehouses exists
);
CREATE INDEX idx_po_delivery_items_delivery ON po_delivery_items(po_delivery_id);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['suppliers','subcontractors','material_requests','rfqs','purchase_orders'] LOOP
    EXECUTE format('CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t);
  END LOOP;
END $$;
