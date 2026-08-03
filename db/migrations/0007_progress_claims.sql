-- =====================================================================
-- 0007_progress_claims.sql — Module 8: Progress Claims
-- =====================================================================

CREATE TABLE claims (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id                UUID NOT NULL REFERENCES projects(id),
  claim_number              TEXT NOT NULL,
  claim_type                TEXT NOT NULL CHECK (claim_type IN ('client','subcontractor')),
  customer_id               UUID REFERENCES customers(id),
  subcontractor_id          UUID REFERENCES subcontractors(id),
  claim_period_start        DATE NOT NULL,
  claim_period_end          DATE NOT NULL,
  status                    TEXT NOT NULL DEFAULT 'draft' CHECK (status IN
                             ('draft','submitted','under_review','certified','rejected','paid')),
  cumulative_percent_complete NUMERIC(5,2),
  claim_amount              NUMERIC(18,2) NOT NULL DEFAULT 0,
  retention_percent         NUMERIC(5,2) NOT NULL DEFAULT 0,
  retention_amount          NUMERIC(18,2) NOT NULL DEFAULT 0,
  net_claim_amount          NUMERIC(18,2) NOT NULL DEFAULT 0,
  submitted_by              UUID REFERENCES users(id) ON DELETE SET NULL,
  certified_by              UUID REFERENCES users(id) ON DELETE SET NULL,
  certified_at              TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, claim_number),
  CHECK (
    (claim_type = 'client' AND customer_id IS NOT NULL AND subcontractor_id IS NULL) OR
    (claim_type = 'subcontractor' AND subcontractor_id IS NOT NULL AND customer_id IS NULL)
  )
);
CREATE INDEX idx_claims_company_status ON claims(company_id, status);
CREATE INDEX idx_claims_project ON claims(project_id);

CREATE TABLE claim_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id          UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  quotation_item_id UUID REFERENCES quotation_items(id) ON DELETE SET NULL,
  description       TEXT NOT NULL,
  contract_quantity NUMERIC(18,4),
  previous_percent  NUMERIC(5,2) NOT NULL DEFAULT 0,
  current_percent   NUMERIC(5,2) NOT NULL DEFAULT 0,
  cumulative_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  amount            NUMERIC(18,2) NOT NULL DEFAULT 0
);
CREATE INDEX idx_claim_items_claim ON claim_items(claim_id);

CREATE TABLE retention_records (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID NOT NULL REFERENCES projects(id),
  claim_id         UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  amount_withheld  NUMERIC(18,2) NOT NULL,
  release_due_date DATE,
  released_at      TIMESTAMPTZ,
  released_amount  NUMERIC(18,2),
  status           TEXT NOT NULL DEFAULT 'held' CHECK (status IN ('held','partially_released','released'))
);
CREATE INDEX idx_retention_records_project ON retention_records(project_id, status);

CREATE TABLE payment_certificates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id          UUID NOT NULL UNIQUE REFERENCES claims(id) ON DELETE CASCADE,
  certificate_number TEXT NOT NULL,
  issued_date       DATE NOT NULL,
  amount            NUMERIC(18,2) NOT NULL,
  document_id       UUID,  -- FK added in 0012 once documents exists
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['claims'] LOOP
    EXECUTE format('CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t);
  END LOOP;
END $$;
