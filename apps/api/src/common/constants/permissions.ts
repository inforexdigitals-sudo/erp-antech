/**
 * Mirrors db/migrations/0016_seed_permissions.sql exactly — these are
 * the only valid arguments to @RequirePermission(). Keeping them as
 * constants instead of inline strings means a typo fails at compile
 * time instead of silently never matching in the seeded permission
 * table.
 */
export const PERMISSIONS = {
  CRM_VIEW: 'crm.view',
  CRM_CREATE: 'crm.create',
  CRM_EDIT: 'crm.edit',
  CRM_DELETE: 'crm.delete',

  QUOTATION_VIEW: 'quotation.view',
  QUOTATION_CREATE: 'quotation.create',
  QUOTATION_EDIT: 'quotation.edit',
  QUOTATION_DELETE: 'quotation.delete',
  QUOTATION_APPROVE: 'quotation.approve',
  QUOTATION_EXPORT: 'quotation.export',

  PURCHASE_ORDER_VIEW: 'purchase_order.view',
  PURCHASE_ORDER_CREATE: 'purchase_order.create',
  PURCHASE_ORDER_EDIT: 'purchase_order.edit',
  PURCHASE_ORDER_DELETE: 'purchase_order.delete',
  PURCHASE_ORDER_APPROVE: 'purchase_order.approve',
  // Added in db/migrations/0020 alongside ACCOUNTING_EXPORT, for the PDF
  // letterhead export batch — 0016 seeded quotation.export/claim.export
  // but no purchase_order.export.
  PURCHASE_ORDER_EXPORT: 'purchase_order.export',

  PROJECT_VIEW: 'project.view',
  PROJECT_CREATE: 'project.create',
  PROJECT_EDIT: 'project.edit',
  PROJECT_DELETE: 'project.delete',

  COSTING_VIEW: 'costing.view',
  COSTING_EDIT: 'costing.edit',

  VARIATION_ORDER_VIEW: 'variation_order.view',
  VARIATION_ORDER_CREATE: 'variation_order.create',
  VARIATION_ORDER_EDIT: 'variation_order.edit',
  VARIATION_ORDER_APPROVE: 'variation_order.approve',

  TIMESHEET_VIEW: 'timesheet.view',
  TIMESHEET_CREATE: 'timesheet.create',
  TIMESHEET_EDIT: 'timesheet.edit',
  TIMESHEET_APPROVE: 'timesheet.approve',

  CLAIM_VIEW: 'claim.view',
  CLAIM_CREATE: 'claim.create',
  CLAIM_EDIT: 'claim.edit',
  CLAIM_APPROVE: 'claim.approve',
  CLAIM_EXPORT: 'claim.export',

  // Subcontractors live in the same migration/domain as Suppliers
  // (db/migrations/0005) and 0016 seeds no dedicated "subcontractor"
  // module, so — same as SuppliersController — this reuses
  // purchase_order.*.
  //
  // Invoices/Payments: 0016's "accounting" module only covers
  // integration config ("View accounting sync status" / "Configure
  // accounting integration"), not invoice CRUD — there's no closer
  // match without a new permissions migration, so ACCOUNTING_VIEW/EDIT
  // are reused here too.
  ACCOUNTING_VIEW: 'accounting.view',
  ACCOUNTING_EDIT: 'accounting.edit',
  // Added in db/migrations/0020 — invoice PDF export, kept independent
  // of ACCOUNTING_VIEW so it can be revoked separately in a future role.
  ACCOUNTING_EXPORT: 'accounting.export',

  PROCUREMENT_VIEW: 'procurement.view',
  PROCUREMENT_CREATE: 'procurement.create',
  PROCUREMENT_EDIT: 'procurement.edit',
  PROCUREMENT_APPROVE: 'procurement.approve',

  PAYROLL_VIEW: 'payroll.view',
  PAYROLL_CREATE: 'payroll.create',
  PAYROLL_EXPORT: 'payroll.export',

  DOCUMENT_VIEW: 'document.view',
  DOCUMENT_CREATE: 'document.create',
  DOCUMENT_DELETE: 'document.delete',

  DASHBOARD_VIEW: 'dashboard.view',

  // 0016 already seeded settings.view/settings.edit but nothing used
  // them until the Company Profile module (address/contact/logo — used
  // for the PDF letterhead). Not full Settings & RBAC (module 17,
  // still not started) — just this one slice.
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_EDIT: 'settings.edit',

  // Already seeded in 0016 ("View/Create/Edit users/roles", "Delete/deactivate
  // users") but unused until the User Management batch — covers both Users
  // and Roles admin (creating a role is "editing access", the same module).
  USER_MANAGEMENT_VIEW: 'user_management.view',
  USER_MANAGEMENT_CREATE: 'user_management.create',
  USER_MANAGEMENT_EDIT: 'user_management.edit',
  USER_MANAGEMENT_DELETE: 'user_management.delete',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
