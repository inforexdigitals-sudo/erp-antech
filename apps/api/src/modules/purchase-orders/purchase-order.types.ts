/** Matches the CHECK constraint on purchase_orders.status (db/migrations/0005, extended by 0019). */
export const PURCHASE_ORDER_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'issued',
  'partially_received',
  'received',
  'closed',
  'cancelled',
] as const;
export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];

/** purchase_order_items.cost_category shares the same domain as elsewhere (db/migrations/0005) — see common/constants/cost-category.ts. */
export { COST_CATEGORIES, type CostCategory } from '../../common/constants/cost-category';
