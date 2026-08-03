-- =====================================================================
-- 0021_company_header_tagline.sql
-- Addendum, added alongside the CompanyHeader component (Phase 6 batch 4
-- request: a letterhead-style app header with two description lines
-- under the logo). The header component takes these as props rather
-- than hardcoding them, so they need a place to live — two more
-- optional text fields on `companies`, editable via the same Company
-- Profile settings page as address/phone/email/logo.
-- =====================================================================

ALTER TABLE companies
  ADD COLUMN description1 TEXT,
  ADD COLUMN description2 TEXT;
