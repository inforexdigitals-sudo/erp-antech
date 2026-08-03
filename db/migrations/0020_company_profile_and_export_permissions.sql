-- =====================================================================
-- 0020_company_profile_and_export_permissions.sql
-- Addendum, added while building PDF letterhead export (Phase 6 batch 3
-- request: "quotation and invoice should be generated in PDF using our
-- company letterhead"). Two unrelated but co-shipped changes:
--
-- 1. `companies` (0001) had no address/contact fields at all — name,
--    legal_name, registration_number, logo_url only. A printed
--    letterhead needs a real postal address and contact details, and
--    logo_url alone assumed an already-hosted external image; there's
--    no working file storage yet (document-storage.service.ts is still
--    a stub — see apps/api/README.md), so the logo is stored directly
--    as bytes on the company row instead of standing up real S3/MinIO
--    wiring just for one image per tenant.
--
-- 2. `quotation.export` and `claim.export` were already seeded (0016)
--    but never used. Purchase Orders and Invoices need the same
--    "export/print this document" permission and 0016 seeded neither
--    module with one — accounting.view/edit covers integration config,
--    not printing an invoice. Added here rather than reusing
--    purchase_order.view / accounting.view, so export can be revoked
--    independently of view in a future role.
--
-- No change needed for Company Profile itself — 0016 already seeded
-- settings.view / settings.edit, which this reuses.
-- =====================================================================

ALTER TABLE companies
  ADD COLUMN address_line1  TEXT,
  ADD COLUMN address_line2  TEXT,
  ADD COLUMN city           TEXT,
  ADD COLUMN state_province TEXT,
  ADD COLUMN postal_code    TEXT,
  ADD COLUMN phone          TEXT,
  ADD COLUMN email          TEXT,
  ADD COLUMN website        TEXT,
  ADD COLUMN logo_data      BYTEA,
  ADD COLUMN logo_mime_type TEXT;

INSERT INTO permissions (module, action, code, description) VALUES
  ('purchase_order', 'export', 'purchase_order.export', 'Export purchase order PDF'),
  ('accounting', 'export', 'accounting.export', 'Export invoice PDF')
ON CONFLICT (code) DO NOTHING;
