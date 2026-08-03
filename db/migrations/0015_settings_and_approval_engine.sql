-- =====================================================================
-- 0015_settings_and_approval_engine.sql — Module 18: Settings
-- Also defines the generic Approval Workflow engine referenced by
-- Quotations, PRs, POs, VOs, Claims, Timesheets and Leave Requests
-- (FR-3.5, FR-5.8, FR-6.4, FR-9.2, FR-11.6, FR-18.4), and retrofits
-- the tax_code_id FKs forward-declared in earlier migrations.
-- =====================================================================

CREATE TABLE tax_codes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code         TEXT NOT NULL,
  name         TEXT NOT NULL,
  rate_percent NUMERIC(5,2) NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (company_id, code)
);

ALTER TABLE quotation_items
  ADD CONSTRAINT fk_quotation_items_tax_code
  FOREIGN KEY (tax_code_id) REFERENCES tax_codes(id) ON DELETE SET NULL;

ALTER TABLE tax_mappings
  ADD CONSTRAINT fk_tax_mappings_internal_tax_code
  FOREIGN KEY (internal_tax_code_id) REFERENCES tax_codes(id) ON DELETE CASCADE;

CREATE TABLE email_templates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code       TEXT NOT NULL,   -- e.g. 'quotation_sent','po_issued','claim_certified'
  subject    TEXT NOT NULL,
  body_html  TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);

CREATE TABLE company_settings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  setting_key   TEXT NOT NULL,   -- e.g. 'default_retention_percent','fiscal_year_start_month'
  setting_value JSONB NOT NULL,
  UNIQUE (company_id, setting_key)
);

-- ---------------------------------------------------------------------
-- Generic approval workflow engine
-- ---------------------------------------------------------------------
CREATE TABLE approval_workflows (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  module      TEXT NOT NULL CHECK (module IN
              ('quotation','purchase_request','purchase_order','variation_order','claim','timesheet','leave_request')),
  name        TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  min_amount  NUMERIC(18,2),
  max_amount  NUMERIC(18,2),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_approval_workflows_company_module ON approval_workflows(company_id, module) WHERE is_active;

CREATE TABLE approval_steps (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_workflow_id UUID NOT NULL REFERENCES approval_workflows(id) ON DELETE CASCADE,
  step_order          INTEGER NOT NULL,
  approver_role_id    UUID REFERENCES roles(id) ON DELETE SET NULL,
  approver_user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (approval_workflow_id, step_order),
  CHECK (approver_role_id IS NOT NULL OR approver_user_id IS NOT NULL)
);

CREATE TABLE approval_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  approval_workflow_id UUID REFERENCES approval_workflows(id) ON DELETE SET NULL,
  entity_type         TEXT NOT NULL,   -- 'quotation','purchase_order','variation_order','claim',...
  entity_id           UUID NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  current_step_order  INTEGER NOT NULL DEFAULT 1,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_approval_requests_entity ON approval_requests(entity_type, entity_id);
CREATE INDEX idx_approval_requests_company_status ON approval_requests(company_id, status);

CREATE TABLE approval_actions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_request_id UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  step_order         INTEGER NOT NULL,
  actor_user_id      UUID NOT NULL REFERENCES users(id),
  decision           TEXT NOT NULL CHECK (decision IN ('approved','rejected')),
  comments           TEXT,
  decided_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_approval_actions_request ON approval_actions(approval_request_id);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['email_templates','approval_workflows','approval_requests'] LOOP
    EXECUTE format('CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t);
  END LOOP;
END $$;
