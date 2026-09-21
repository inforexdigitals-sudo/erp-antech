-- =====================================================================
-- 0024_claim_delete_permission.sql
-- Addendum to module 8 (Progress Claims): 0016_seed_permissions.sql
-- seeded claim.view/create/edit/approve/export but missed delete — every
-- other document type with a delete action (quotation, project,
-- purchase_order, document, user_management) has its own distinct
-- *.delete permission, separate from edit, and claims never got one.
-- Existing companies' roles won't have this granted automatically (see
-- 0016's own header comment — role_permissions is seeded per-company by
-- the app's bootstrap routine, not by a migration); an Owner/Admin needs
-- to grant "Delete progress claims" to a role via Settings & RBAC before
-- anyone can use it.
-- =====================================================================

INSERT INTO permissions (module, action, code, description) VALUES
  ('claim', 'delete', 'claim.delete', 'Delete progress claims')
ON CONFLICT (code) DO NOTHING;
