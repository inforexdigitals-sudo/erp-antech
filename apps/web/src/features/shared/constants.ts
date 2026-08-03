/** Mirrors apps/api/src/common/constants/cost-category.ts — shared by Quotations, Purchase Orders, Variation Orders, Project Costing. */
export const COST_CATEGORIES = ['material', 'labour', 'equipment', 'subcontractor'] as const;
export type CostCategory = (typeof COST_CATEGORIES)[number];
