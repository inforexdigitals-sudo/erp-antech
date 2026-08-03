/**
 * Matches the CHECK constraint repeated across quotation_items.category,
 * purchase_order_items.cost_category, budget_lines.cost_category, and
 * cost_transactions.cost_category (db/migrations/0003, 0005, 0009) — the
 * same four-value domain, so defined once here rather than re-declared
 * per module.
 */
export const COST_CATEGORIES = ['material', 'labour', 'equipment', 'subcontractor'] as const;
export type CostCategory = (typeof COST_CATEGORIES)[number];
