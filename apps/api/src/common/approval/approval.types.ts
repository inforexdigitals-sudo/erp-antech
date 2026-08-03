/** Matches the CHECK constraint on approval_workflows.module (db/migrations/0015). */
export const APPROVAL_MODULES = [
  'quotation',
  'purchase_request',
  'purchase_order',
  'variation_order',
  'claim',
  'timesheet',
  'leave_request',
] as const;
export type ApprovalModule = (typeof APPROVAL_MODULES)[number];

export const APPROVAL_REQUEST_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const;
export type ApprovalRequestStatus = (typeof APPROVAL_REQUEST_STATUSES)[number];
