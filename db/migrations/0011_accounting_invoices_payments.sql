-- =====================================================================
-- 0011_accounting_invoices_payments.sql — Module 13: Accounting Integration
-- Also defines invoices/payments, the tail end of the core workflow
-- (claim -> invoice -> payment -> project close).
-- =====================================================================

CREATE TABLE accounting_connections (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider                TEXT NOT NULL CHECK (provider IN ('xero','quickbooks','odoo','sap','dynamics')),
  status                  TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected','disconnected','error')),
  access_token_encrypted  TEXT,
  refresh_token_encrypted TEXT,
  connected_by            UUID REFERENCES users(id) ON DELETE SET NULL,
  connected_at            TIMESTAMPTZ,
  last_synced_at          TIMESTAMPTZ,
  UNIQUE (company_id, provider)
);

CREATE TABLE tax_mappings (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accounting_connection_id UUID NOT NULL REFERENCES accounting_connections(id) ON DELETE CASCADE,
  internal_tax_code_id    UUID NOT NULL,  -- FK added in 0015 once tax_codes exists
  external_tax_code       TEXT NOT NULL
);
CREATE INDEX idx_tax_mappings_connection ON tax_mappings(accounting_connection_id);

CREATE TABLE journal_entry_exports (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  accounting_connection_id UUID NOT NULL REFERENCES accounting_connections(id),
  source_type             TEXT NOT NULL CHECK (source_type IN ('claim','invoice','purchase_order')),
  source_id               UUID NOT NULL,
  external_reference      TEXT,
  status                  TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','synced','failed')),
  synced_at               TIMESTAMPTZ,
  error_message           TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_journal_entry_exports_source ON journal_entry_exports(source_type, source_id);
CREATE INDEX idx_journal_entry_exports_status ON journal_entry_exports(company_id, status);

-- ---------------------------------------------------------------------
-- Invoices & Payments
-- ---------------------------------------------------------------------
CREATE TABLE invoices (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id     UUID NOT NULL REFERENCES projects(id),
  claim_id       UUID REFERENCES claims(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  customer_id    UUID NOT NULL REFERENCES customers(id),
  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN
                  ('draft','sent','partially_paid','paid','overdue','void')),
  issue_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date       DATE,
  subtotal       NUMERIC(18,2) NOT NULL DEFAULT 0,
  tax_amount     NUMERIC(18,2) NOT NULL DEFAULT 0,
  total          NUMERIC(18,2) NOT NULL DEFAULT 0,
  amount_paid    NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, invoice_number)
);
CREATE INDEX idx_invoices_company_status ON invoices(company_id, status);
CREATE INDEX idx_invoices_project ON invoices(project_id);
CREATE INDEX idx_invoices_customer ON invoices(customer_id);

CREATE TABLE payments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id   UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount       NUMERIC(18,2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  method       TEXT,
  reference    TEXT,
  recorded_by  UUID NOT NULL REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_invoice ON payments(invoice_id);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['invoices'] LOOP
    EXECUTE format('CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t);
  END LOOP;
END $$;
