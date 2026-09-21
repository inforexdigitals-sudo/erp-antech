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

/** Adds the plain contract-value-vs-spend view (see CostingService.getDashboard) to the budget-vs-actual breakdown above. */
export interface ProjectCostingDashboard extends CostingDashboard {
  contractValue: number;
  balance: number;
  profit: number;
}

export interface ManualBudgetLineInput {
  costCategory: CostCategory;
  description: string;
  budgetedAmount: number;
}

/** A one-off material/other purchase logged directly against a project, with no PO behind it — see GET/POST /projects/:id/expenses. */
export interface ProjectExpense {
  id: string;
  description: string;
  costCategory: CostCategory;
  amount: string;
  expenseDate: string;
  creator: { id: string; fullName: string };
}

export interface CreateExpenseInput {
  description: string;
  costCategory: CostCategory;
  amount: number;
  expenseDate: string;
}

export const projectCostingApi = {
  getBudget: (projectId: string) => api.get<ProjectBudget>(`/projects/${projectId}/budget`),
  getDashboard: (projectId: string) => api.get<ProjectCostingDashboard>(`/projects/${projectId}/costing`),
  initFromQuotation: (projectId: string) => api.post<ProjectBudget>(`/projects/${projectId}/budget/from-quotation`),
  createManualBudget: (projectId: string, lines: ManualBudgetLineInput[]) =>
    api.post<ProjectBudget>(`/projects/${projectId}/budget/manual`, { lines }),
  listExpenses: (projectId: string) => api.get<ProjectExpense[]>(`/projects/${projectId}/expenses`),
  createExpense: (projectId: string, input: CreateExpenseInput) =>
    api.post<ProjectExpense>(`/projects/${projectId}/expenses`, input),
};
