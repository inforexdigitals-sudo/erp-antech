/** Matches the CHECK constraint on variation_orders.cause (db/migrations/0008). */
export const VARIATION_ORDER_CAUSES = ['client_instruction', 'site_condition', 'design_change', 'other'] as const;
export type VariationOrderCause = (typeof VARIATION_ORDER_CAUSES)[number];

/** Matches the CHECK constraint on variation_orders.status (db/migrations/0008). */
export const VARIATION_ORDER_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'client_signoff_pending',
  'client_approved',
] as const;
export type VariationOrderStatus = (typeof VARIATION_ORDER_STATUSES)[number];
