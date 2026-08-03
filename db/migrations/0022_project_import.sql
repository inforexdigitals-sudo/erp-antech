-- =====================================================================
-- 0022_project_import.sql
-- Addendum, added by explicit request: digitizing historical Excel/PDF
-- records by uploading an old quotation/project PDF, extracting text
-- from it, and creating a real Project from a user-reviewed guess at
-- the key fields (customer, name, dates, contract value) — never
-- silently, always with a review step before anything lands in
-- `projects`.
--
-- The original file's bytes are stored directly on this row (same
-- pattern as `companies.logo_data`, 0020) rather than through the
-- still-stubbed document-storage service — real S3/MinIO wiring is
-- deferred to the jobs/integrations batch, and this is the one
-- self-contained feature where the ENTIRE POINT is "get my old paper
-- actually into the software," so a stub reference instead of the real
-- bytes would defeat the purpose.
-- =====================================================================

CREATE TABLE imported_files (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  file_name       TEXT NOT NULL,
  mime_type       TEXT NOT NULL,
  file_data       BYTEA NOT NULL,
  extracted_text  TEXT,
  status          TEXT NOT NULL DEFAULT 'pending_review'
                  CHECK (status IN ('pending_review', 'completed', 'discarded')),
  project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
  uploaded_by     UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_imported_files_company ON imported_files(company_id);
CREATE INDEX idx_imported_files_project ON imported_files(project_id);
