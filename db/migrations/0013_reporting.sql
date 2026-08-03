-- =====================================================================
-- 0013_reporting.sql — Module 15: Reporting
-- Standard reports (Project Profitability, Sales, Purchase, Inventory,
-- Cash Flow, Employee, Payroll) are read-only queries/views over the
-- transactional tables already defined — they need no dedicated tables.
-- This migration only adds the custom report builder and export log.
-- =====================================================================

CREATE TABLE saved_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  base_entity  TEXT NOT NULL,   -- e.g. 'projects','purchase_orders','claims'
  filters      JSONB NOT NULL DEFAULT '{}',
  group_by     JSONB NOT NULL DEFAULT '[]',
  aggregates   JSONB NOT NULL DEFAULT '[]',
  created_by   UUID NOT NULL REFERENCES users(id),
  is_shared    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_saved_reports_company ON saved_reports(company_id);

CREATE TABLE report_exports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  saved_report_id UUID REFERENCES saved_reports(id) ON DELETE SET NULL,
  report_type     TEXT NOT NULL,
  format          TEXT NOT NULL CHECK (format IN ('pdf','excel')),
  requested_by    UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_report_exports_company ON report_exports(company_id, created_at DESC);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['saved_reports'] LOOP
    EXECUTE format('CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t);
  END LOOP;
END $$;
