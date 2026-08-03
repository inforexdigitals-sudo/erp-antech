-- =====================================================================
-- 0001_core_and_identity.sql
-- Extensions, tenant root, users/roles/permissions (RBAC), audit, and
-- document-numbering sequences. Every tenant-scoped table in later
-- migrations carries a company_id FK to companies(id).
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;     -- case-insensitive email
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- fast ILIKE / fuzzy search

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- Tenant root
-- ---------------------------------------------------------------------
CREATE TABLE companies (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT NOT NULL,
  legal_name           TEXT,
  registration_number  TEXT,
  logo_url             TEXT,
  base_currency        CHAR(3) NOT NULL DEFAULT 'SGD',
  country_code         CHAR(2) NOT NULL DEFAULT 'SG',
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE departments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  parent_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_departments_company ON departments(company_id);

-- ---------------------------------------------------------------------
-- Internal users (staff)
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  department_id        UUID REFERENCES departments(id) ON DELETE SET NULL,
  employee_number      TEXT,
  full_name            TEXT NOT NULL,
  email                CITEXT NOT NULL,
  phone                TEXT,
  password_hash        TEXT NOT NULL,
  job_title            TEXT,
  hire_date            DATE,
  termination_date     DATE,
  avatar_url           TEXT,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  two_factor_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
  two_factor_secret_encrypted TEXT,
  last_login_at        TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at           TIMESTAMPTZ,
  UNIQUE (company_id, email)
);
CREATE INDEX idx_users_company ON users(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_department ON users(department_id);
CREATE INDEX idx_users_name_trgm ON users USING GIN (full_name gin_trgm_ops);

-- ---------------------------------------------------------------------
-- RBAC: roles are per-company (seeded from a system template on
-- company creation); permissions are a fixed, global reference set.
-- ---------------------------------------------------------------------
CREATE TABLE roles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  is_system_role BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);
CREATE INDEX idx_roles_company ON roles(company_id);

CREATE TABLE permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module      TEXT NOT NULL,
  action      TEXT NOT NULL CHECK (action IN ('view','create','edit','delete','approve','export')),
  code        TEXT NOT NULL UNIQUE,        -- e.g. 'quotation.approve'
  description TEXT
);

CREATE TABLE role_permissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  UNIQUE (role_id, permission_id)
);
CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);

CREATE TABLE user_roles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id    UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  UNIQUE (user_id, role_id)
);
CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role_id);

-- ---------------------------------------------------------------------
-- External portal accounts (client / supplier / subcontractor logins).
-- party_id points at customers.id / suppliers.id / subcontractors.id
-- depending on party_type; enforced at the application layer since the
-- referenced table varies (no native polymorphic FK in Postgres).
-- ---------------------------------------------------------------------
CREATE TABLE portal_accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  party_type    TEXT NOT NULL CHECK (party_type IN ('customer','supplier','subcontractor')),
  party_id      UUID NOT NULL,
  email         CITEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, email)
);
CREATE INDEX idx_portal_accounts_party ON portal_accounts(party_type, party_id);

-- ---------------------------------------------------------------------
-- Audit log (append-only) and login history
-- ---------------------------------------------------------------------
CREATE TABLE audit_logs (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  actor_user_id           UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_portal_account_id UUID REFERENCES portal_accounts(id) ON DELETE SET NULL,
  action                  TEXT NOT NULL,          -- create/update/delete/approve/reject/login/...
  entity_type             TEXT NOT NULL,
  entity_id               UUID,
  before_data             JSONB,
  after_data               JSONB,
  ip_address              INET,
  user_agent              TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_company_created ON audit_logs(company_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

CREATE TABLE login_history (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID REFERENCES users(id) ON DELETE CASCADE,
  portal_account_id  UUID REFERENCES portal_accounts(id) ON DELETE CASCADE,
  ip_address         INET,
  user_agent         TEXT,
  success            BOOLEAN NOT NULL,
  failure_reason     TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR portal_account_id IS NOT NULL)
);
CREATE INDEX idx_login_history_user ON login_history(user_id, created_at DESC);

-- ---------------------------------------------------------------------
-- Document numbering sequences (QT-0001, PO-0001, ...)
-- ---------------------------------------------------------------------
CREATE TABLE document_numbering_sequences (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN
                 ('quotation','purchase_request','rfq','purchase_order',
                  'material_request','claim','variation_order','invoice',
                  'stock_transfer')),
  prefix        TEXT NOT NULL,
  next_number   INTEGER NOT NULL DEFAULT 1,
  padding       INTEGER NOT NULL DEFAULT 4,
  UNIQUE (company_id, document_type)
);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['companies','departments','users','roles','portal_accounts'] LOOP
    EXECUTE format('CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t);
  END LOOP;
END $$;
