-- =====================================================================
-- 0012_documents.sql — Module 14: Document Management
-- Generic, polymorphic attachment store used across every module
-- (quotations, projects, POs, claims, VOs, site reports, ...).
-- =====================================================================

CREATE TABLE document_folders (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  related_entity_type  TEXT CHECK (related_entity_type IN ('project','customer','supplier','company')),
  related_entity_id    UUID,
  parent_folder_id     UUID REFERENCES document_folders(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_document_folders_entity ON document_folders(related_entity_type, related_entity_id);
CREATE INDEX idx_document_folders_parent ON document_folders(parent_folder_id);

CREATE TABLE documents (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  folder_id            UUID REFERENCES document_folders(id) ON DELETE SET NULL,
  related_entity_type  TEXT NOT NULL,   -- 'project','quotation','purchase_order','claim','variation_order','site_report',...
  related_entity_id    UUID NOT NULL,
  file_name            TEXT NOT NULL,
  storage_key          TEXT NOT NULL,   -- object storage path/key (S3-compatible)
  mime_type            TEXT NOT NULL,
  size_bytes           BIGINT NOT NULL,
  current_version_id   UUID,  -- FK added after document_versions exists
  uploaded_by          UUID NOT NULL REFERENCES users(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_documents_entity ON documents(related_entity_type, related_entity_id);
CREATE INDEX idx_documents_company ON documents(company_id);
CREATE INDEX idx_documents_filename_trgm ON documents USING GIN (file_name gin_trgm_ops);

CREATE TABLE document_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  storage_key   TEXT NOT NULL,
  size_bytes    BIGINT NOT NULL,
  uploaded_by   UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, version_number)
);
CREATE INDEX idx_document_versions_document ON document_versions(document_id);

ALTER TABLE documents
  ADD CONSTRAINT fk_documents_current_version
  FOREIGN KEY (current_version_id) REFERENCES document_versions(id) ON DELETE SET NULL;

CREATE TABLE document_permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  role_id     UUID REFERENCES roles(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  permission  TEXT NOT NULL CHECK (permission IN ('view','edit','delete')),
  CHECK (role_id IS NOT NULL OR user_id IS NOT NULL)
);
CREATE INDEX idx_document_permissions_document ON document_permissions(document_id);

-- Retrofit the forward-declared FK from progress-claims (0007)
ALTER TABLE payment_certificates
  ADD CONSTRAINT fk_payment_certificates_document
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['documents'] LOOP
    EXECUTE format('CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t);
  END LOOP;
END $$;

-- Retrofit site_report_photos (references documents; defined here to
-- keep the documents<->photos dependency in one direction).
CREATE TABLE site_report_photos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_report_id UUID NOT NULL REFERENCES site_reports(id) ON DELETE CASCADE,
  document_id    UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  caption        TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_site_report_photos_report ON site_report_photos(site_report_id);
