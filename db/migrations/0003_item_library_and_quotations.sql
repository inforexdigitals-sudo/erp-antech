-- =====================================================================
-- 0003_item_library_and_quotations.sql — Module 3: Quotation Management
-- Also defines item_library, the shared material/labour/equipment
-- catalog reused by Quotations, Procurement/PO, Inventory, and Costing.
-- =====================================================================

CREATE TABLE item_library (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code              TEXT NOT NULL,
  name              TEXT NOT NULL,
  category          TEXT NOT NULL CHECK (category IN ('material','labour','equipment','subcontractor')),
  unit              TEXT NOT NULL,               -- e.g. 'm3', 'kg', 'hr', 'lot'
  default_unit_cost NUMERIC(18,4) NOT NULL DEFAULT 0,
  default_unit_price NUMERIC(18,4) NOT NULL DEFAULT 0,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);
CREATE INDEX idx_item_library_company_category ON item_library(company_id, category) WHERE is_active;
CREATE INDEX idx_item_library_name_trgm ON item_library USING GIN (name gin_trgm_ops);

CREATE TABLE quotations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  quotation_number    TEXT NOT NULL,
  customer_id         UUID NOT NULL REFERENCES customers(id),
  lead_id             UUID REFERENCES leads(id) ON DELETE SET NULL,
  opportunity_id      UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  title               TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN
                       ('draft','pending_approval','approved','sent','accepted','rejected','expired','converted')),
  current_revision_id UUID,  -- FK added after quotation_revisions exists
  owner_user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  valid_until         DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, quotation_number)
);
CREATE INDEX idx_quotations_company_status ON quotations(company_id, status);
CREATE INDEX idx_quotations_customer ON quotations(customer_id);

CREATE TABLE quotation_revisions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id    UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  subtotal        NUMERIC(18,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(18,2) NOT NULL DEFAULT 0,
  markup_percent  NUMERIC(6,2) NOT NULL DEFAULT 0,
  total           NUMERIC(18,2) NOT NULL DEFAULT 0,
  notes           TEXT,
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (quotation_id, revision_number)
);
CREATE INDEX idx_quotation_revisions_quotation ON quotation_revisions(quotation_id);

ALTER TABLE quotations
  ADD CONSTRAINT fk_quotations_current_revision
  FOREIGN KEY (current_revision_id) REFERENCES quotation_revisions(id) ON DELETE SET NULL;

CREATE TABLE quotation_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_revision_id UUID NOT NULL REFERENCES quotation_revisions(id) ON DELETE CASCADE,
  item_library_id     UUID REFERENCES item_library(id) ON DELETE SET NULL,
  description         TEXT NOT NULL,
  category            TEXT NOT NULL CHECK (category IN ('material','labour','equipment','subcontractor')),
  unit                TEXT NOT NULL,
  quantity            NUMERIC(18,4) NOT NULL DEFAULT 1,
  unit_cost           NUMERIC(18,4) NOT NULL DEFAULT 0,
  unit_price          NUMERIC(18,4) NOT NULL DEFAULT 0,
  markup_percent      NUMERIC(6,2) NOT NULL DEFAULT 0,
  discount_percent    NUMERIC(6,2) NOT NULL DEFAULT 0,
  tax_code_id         UUID,  -- FK added in 0015 once tax_codes exists
  line_total          NUMERIC(18,2) NOT NULL DEFAULT 0,
  sort_order          INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_quotation_items_revision ON quotation_items(quotation_revision_id);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['item_library','quotations'] LOOP
    EXECUTE format('CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t);
  END LOOP;
END $$;
