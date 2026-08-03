/** Matches the CHECK constraint on cost_transactions.transaction_type (db/migrations/0009). */
export const COST_TRANSACTION_TYPES = ['committed', 'actual'] as const;
export type CostTransactionType = (typeof COST_TRANSACTION_TYPES)[number];

/** Matches the CHECK constraint on cost_transactions.source_type (db/migrations/0009). */
export const COST_TRANSACTION_SOURCE_TYPES = [
  'purchase_order',
  'timesheet',
  'stock_issue',
  'subcontractor_claim',
  'variation_order',
] as const;
export type CostTransactionSourceType = (typeof COST_TRANSACTION_SOURCE_TYPES)[number];

/** Matches the CHECK constraint on project_budgets.source (db/migrations/0009). */
export const BUDGET_SOURCES = ['quotation', 'manual'] as const;
export type BudgetSource = (typeof BUDGET_SOURCES)[number];
