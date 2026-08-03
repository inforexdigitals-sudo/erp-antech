import { api } from '../../lib/api-client';
import type { CostCategory } from '../shared/constants';

export interface BudgetLine {
  id: string;
  costCategory: CostCategory;
  description: string;
  budgetedAmount: string;
}

export interface ProjectBudget {
  id: string;
  source: 'quotation' | 'manual';
  totalBudget: string;
  lines: BudgetLine[];
}

export interface CostCategoryRow {
  costCategory: CostCategory;
  budgeted: number;
  committed: number;
  actual: number;
  forecast: number;
  variance: number;
}

export interface CostingDashboard {
  hasBudget: boolean;
  byCategory: CostCategoryRow[];
  totals: Omit<CostCategoryRow, 'costCategory'>;
}

export interface ManualBudgetLineInput {
  costCategory: CostCategory;
  description: string;
  budgetedAmount: number;
}

export const projectCostingApi = {
  getBudget: (projectId: string) => api.get<ProjectBudget>(`/projects/${projectId}/budget`),
  getDashboard: (projectId: string) => api.get<CostingDashboard>(`/projects/${projectId}/costing`),
  initFromQuotation: (projectId: string) => api.post<ProjectBudget>(`/projects/${projectId}/budget/from-quotation`),
  createManualBudget: (projectId: string, lines: ManualBudgetLineInput[]) =>
    api.post<ProjectBudget>(`/projects/${projectId}/budget/manual`, { lines }),
};
