-- =====================================================================
-- 0008_variation_orders.sql — Module 9: Variation Orders
-- =====================================================================

CREATE TABLE variation_orders (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id            UUID NOT NULL REFERENCES projects(id),
  vo_number             TEXT NOT NULL,
  title                 TEXT NOT NULL,
  cause                 TEXT NOT NULL CHECK (cause IN ('client_instruction','site_condition','design_change','other')),
  status                TEXT NOT NULL DEFAULT 'draft' CHECK (status IN
                         ('draft','pending_approval','approved','rejected','client_signoff_pending','client_approved')),
  cost_impact           NUMERIC(18,2) NOT NULL DEFAULT 0,
  revenue_impact        NUMERIC(18,2) NOT NULL DEFAULT 0,
  schedule_impact_days  INTEGER NOT NULL DEFAULT 0,
  requested_by          UUID NOT NULL REFERENCES users(id),
  approved_by           UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, vo_number)
);
CREATE INDEX idx_variation_orders_company_status ON variation_orders(company_id, status);
CREATE INDEX idx_variation_orders_project ON variation_orders(project_id);

CREATE TABLE variation_order_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variation_order_id  UUID NOT NULL REFERENCES variation_orders(id) ON DELETE CASCADE,
  description         TEXT NOT NULL,
  unit                TEXT,
  quantity            NUMERIC(18,4),
  unit_cost           NUMERIC(18,4),
  unit_price          NUMERIC(18,4),
  cost_category       TEXT NOT NULL DEFAULT 'material' CHECK (cost_category IN ('material','labour','equipment','subcontractor'))
);
CREATE INDEX idx_variation_order_items_vo ON variation_order_items(variation_order_id);

CREATE TABLE variation_order_revisions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variation_order_id  UUID NOT NULL REFERENCES variation_orders(id) ON DELETE CASCADE,
  revision_number     INTEGER NOT NULL,
  cost_impact         NUMERIC(18,2) NOT NULL DEFAULT 0,
  revenue_impact      NUMERIC(18,2) NOT NULL DEFAULT 0,
  notes               TEXT,
  created_by          UUID NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (variation_order_id, revision_number)
);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['variation_orders'] LOOP
    EXECUTE format('CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t);
  END LOOP;
END $$;
