-- =====================================================================
-- 0002_crm.sql — Module 2: CRM
-- =====================================================================

CREATE TABLE customers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  registration_number TEXT,
  industry            TEXT,
  billing_address     TEXT,
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  owner_user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);
CREATE INDEX idx_customers_company ON customers(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_name_trgm ON customers USING GIN (name gin_trgm_ops);

CREATE TABLE customer_contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  title       TEXT,
  email       CITEXT,
  phone       TEXT,
  is_primary  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_customer_contacts_customer ON customer_contacts(customer_id);

CREATE TABLE leads (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id        UUID REFERENCES customers(id) ON DELETE SET NULL,
  company_name       TEXT,
  contact_name       TEXT,
  contact_email      CITEXT,
  contact_phone      TEXT,
  source             TEXT,
  stage              TEXT NOT NULL DEFAULT 'new' CHECK (stage IN ('new','contacted','qualified','lost','converted')),
  owner_user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  expected_value     NUMERIC(18,2),
  expected_close_date DATE,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_leads_company_stage ON leads(company_id, stage);
CREATE INDEX idx_leads_owner ON leads(owner_user_id);

CREATE TABLE opportunities (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  lead_id             UUID REFERENCES leads(id) ON DELETE SET NULL,
  customer_id         UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  stage               TEXT NOT NULL DEFAULT 'prospecting' CHECK (stage IN ('prospecting','proposal','negotiation','won','lost')),
  value               NUMERIC(18,2),
  probability_percent SMALLINT CHECK (probability_percent BETWEEN 0 AND 100),
  expected_close_date DATE,
  owner_user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_opportunities_company_stage ON opportunities(company_id, stage);
CREATE INDEX idx_opportunities_customer ON opportunities(customer_id);

-- Communication log, shared across CRM and Projects (module 4)
CREATE TABLE communications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  related_entity_type TEXT NOT NULL CHECK (related_entity_type IN ('customer','lead','opportunity','project')),
  related_entity_id   UUID NOT NULL,
  type                TEXT NOT NULL CHECK (type IN ('call','email','meeting','note')),
  subject             TEXT,
  body                TEXT,
  occurred_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_communications_entity ON communications(related_entity_type, related_entity_id);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['customers','customer_contacts','leads','opportunities'] LOOP
    EXECUTE format('CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t);
  END LOOP;
END $$;
