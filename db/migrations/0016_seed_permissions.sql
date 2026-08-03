-- =====================================================================
-- 0016_seed_permissions.sql
-- Seeds the global permissions reference table (module x action).
-- `permissions` is not tenant-scoped, so this seeds once for the whole
-- deployment. Role -> permission assignment (role_permissions) and the
-- default role set (Owner, PM, QS, ...) are created per-company by the
-- application's "new company" bootstrap routine, not by a migration,
-- since roles.company_id is NOT NULL (see db/migrations/README.md).
-- =====================================================================

INSERT INTO permissions (module, action, code, description) VALUES
  -- Dashboard
  ('dashboard', 'view', 'dashboard.view', 'View company dashboard'),
  -- CRM
  ('crm', 'view', 'crm.view', 'View customers, leads, opportunities'),
  ('crm', 'create', 'crm.create', 'Create customers, leads, opportunities'),
  ('crm', 'edit', 'crm.edit', 'Edit customers, leads, opportunities'),
  ('crm', 'delete', 'crm.delete', 'Delete customers, leads, opportunities'),
  -- Quotation
  ('quotation', 'view', 'quotation.view', 'View quotations'),
  ('quotation', 'create', 'quotation.create', 'Create quotations'),
  ('quotation', 'edit', 'quotation.edit', 'Edit quotations'),
  ('quotation', 'delete', 'quotation.delete', 'Delete quotations'),
  ('quotation', 'approve', 'quotation.approve', 'Approve/send quotations'),
  ('quotation', 'export', 'quotation.export', 'Export quotation PDF'),
  -- Project
  ('project', 'view', 'project.view', 'View projects'),
  ('project', 'create', 'project.create', 'Create projects'),
  ('project', 'edit', 'project.edit', 'Edit projects'),
  ('project', 'delete', 'project.delete', 'Delete projects'),
  -- Purchase Order
  ('purchase_order', 'view', 'purchase_order.view', 'View purchase orders'),
  ('purchase_order', 'create', 'purchase_order.create', 'Create purchase orders'),
  ('purchase_order', 'edit', 'purchase_order.edit', 'Edit purchase orders'),
  ('purchase_order', 'delete', 'purchase_order.delete', 'Delete purchase orders'),
  ('purchase_order', 'approve', 'purchase_order.approve', 'Approve purchase orders'),
  -- Procurement
  ('procurement', 'view', 'procurement.view', 'View procurement/RFQ'),
  ('procurement', 'create', 'procurement.create', 'Create RFQ/material requests'),
  ('procurement', 'edit', 'procurement.edit', 'Edit RFQ/material requests'),
  ('procurement', 'approve', 'procurement.approve', 'Approve procurement decisions'),
  -- Inventory
  ('inventory', 'view', 'inventory.view', 'View stock/inventory'),
  ('inventory', 'create', 'inventory.create', 'Create stock movements'),
  ('inventory', 'edit', 'inventory.edit', 'Adjust stock'),
  ('inventory', 'approve', 'inventory.approve', 'Approve stock adjustments'),
  -- Claim
  ('claim', 'view', 'claim.view', 'View progress claims'),
  ('claim', 'create', 'claim.create', 'Create progress claims'),
  ('claim', 'edit', 'claim.edit', 'Edit progress claims'),
  ('claim', 'approve', 'claim.approve', 'Certify progress claims'),
  ('claim', 'export', 'claim.export', 'Export claim/payment certificate'),
  -- Variation Order
  ('variation_order', 'view', 'variation_order.view', 'View variation orders'),
  ('variation_order', 'create', 'variation_order.create', 'Create variation orders'),
  ('variation_order', 'edit', 'variation_order.edit', 'Edit variation orders'),
  ('variation_order', 'approve', 'variation_order.approve', 'Approve variation orders'),
  -- Costing
  ('costing', 'view', 'costing.view', 'View project costing/budget'),
  ('costing', 'edit', 'costing.edit', 'Edit project budget'),
  -- Timesheet
  ('timesheet', 'view', 'timesheet.view', 'View timesheets'),
  ('timesheet', 'create', 'timesheet.create', 'Submit timesheets'),
  ('timesheet', 'edit', 'timesheet.edit', 'Edit timesheets'),
  ('timesheet', 'approve', 'timesheet.approve', 'Approve timesheets/leave'),
  -- Payroll
  ('payroll', 'view', 'payroll.view', 'View payroll'),
  ('payroll', 'create', 'payroll.create', 'Run payroll export'),
  ('payroll', 'export', 'payroll.export', 'Export payroll file'),
  -- Accounting
  ('accounting', 'view', 'accounting.view', 'View accounting sync status'),
  ('accounting', 'edit', 'accounting.edit', 'Configure accounting integration'),
  -- Document
  ('document', 'view', 'document.view', 'View documents'),
  ('document', 'create', 'document.create', 'Upload documents'),
  ('document', 'delete', 'document.delete', 'Delete documents'),
  -- Reporting
  ('reporting', 'view', 'reporting.view', 'View reports'),
  ('reporting', 'export', 'reporting.export', 'Export reports'),
  -- User Management
  ('user_management', 'view', 'user_management.view', 'View users/roles'),
  ('user_management', 'create', 'user_management.create', 'Create users/roles'),
  ('user_management', 'edit', 'user_management.edit', 'Edit users/roles/permissions'),
  ('user_management', 'delete', 'user_management.delete', 'Delete/deactivate users'),
  -- Settings
  ('settings', 'view', 'settings.view', 'View company settings'),
  ('settings', 'edit', 'settings.edit', 'Edit company settings')
ON CONFLICT (code) DO NOTHING;
