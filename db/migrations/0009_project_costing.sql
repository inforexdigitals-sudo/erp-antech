-- =====================================================================
-- 0009_project_costing.sql — Module 10: Project Costing
--
-- cost_transactions is the real-time cost ledger. Rows are inserted by
-- the service layer (not by hand) whenever a cost-bearing event occurs:
--   - PO approved            -> transaction_type = 'committed'
--   - PO delivery received   -> transaction_type = 'actual' (material)
--   - Timesheet approved     -> transaction_type = 'actual' (labour)
--   - Subcontractor claim certified -> transaction_type = 'actual' (subcontractor)
-- Actual/committed/forecast/variance in module 10's dashboard are all
-- derived by aggregating this table plus budget_lines — no separate
-- "actuals" or "forecast" table is needed.
-- =====================================================================

CREATE TABLE project_budgets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  source              TEXT NOT NULL DEFAULT 'quotation' CHECK (source IN ('quotation','manual')),
  baseline_locked_at  TIMESTAMPTZ,
  total_budget        NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE budget_lines (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_budget_id UUID NOT NULL REFERENCES project_budgets(id) ON DELETE CASCADE,
  cost_category     TEXT NOT NULL CHECK (cost_category IN ('material','labour','equipment','subcontractor')),
  description       TEXT NOT NULL,
  budgeted_amount   NUMERIC(18,2) NOT NULL DEFAULT 0,
  item_library_id   UUID REFERENCES item_library(id) ON DELETE SET NULL
);
CREATE INDEX idx_budget_lines_budget_category ON budget_lines(project_budget_id, cost_category);

CREATE TABLE cost_transactions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id     UUID NOT NULL REFERENCES projects(id),
  cost_category  TEXT NOT NULL CHECK (cost_category IN ('material','labour','equipment','subcontractor')),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('committed','actual')),
  source_type    TEXT NOT NULL CHECK (source_type IN ('purchase_order','timesheet','stock_issue','subcontractor_claim','variation_order')),
  source_id      UUID NOT NULL,
  amount         NUMERIC(18,2) NOT NULL,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cost_transactions_project ON cost_transactions(project_id, cost_category, transaction_type);
CREATE INDEX idx_cost_transactions_source ON cost_transactions(source_type, source_id);
CREATE INDEX idx_cost_transactions_company_date ON cost_transactions(company_id, transaction_date DESC);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['project_budgets'] LOOP
    EXECUTE format('CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t);
  END LOOP;
END $$;
