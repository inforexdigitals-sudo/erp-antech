-- =====================================================================
-- 0023_manual_project_expenses.sql
-- Addendum to module 10 (Project Costing): every cost_transactions row
-- up to now is produced automatically by another module's own workflow
-- (PO approval/delivery, subcontractor claim certification, variation
-- order approval) — there was no way to log a one-off material
-- purchase (nuts, bolts, rod stock, ...) that never goes through a
-- formal PO. project_expenses gives that entry a human-readable
-- description/date; the service layer pairs each row with a
-- cost_transactions row (transaction_type 'actual', source_type
-- 'manual_expense') so it rolls into the same ledger the costing
-- dashboard already reads.
-- =====================================================================

CREATE TABLE project_expenses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id     UUID NOT NULL REFERENCES projects(id),
  description    TEXT NOT NULL,
  cost_category  TEXT NOT NULL CHECK (cost_category IN ('material','labour','equipment','subcontractor')),
  amount         NUMERIC(18,2) NOT NULL,
  expense_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by     UUID NOT NULL REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_project_expenses_project ON project_expenses(project_id, expense_date DESC);

ALTER TABLE cost_transactions
  DROP CONSTRAINT cost_transactions_source_type_check;

ALTER TABLE cost_transactions
  ADD CONSTRAINT cost_transactions_source_type_check
  CHECK (source_type IN
    ('purchase_order','timesheet','stock_issue','subcontractor_claim',
     'variation_order','manual_expense'));
