import { api } from '../../lib/api-client';

export type PortfolioBucket = 'on_track' | 'at_risk' | 'delayed' | 'closed';

export interface PortfolioSummary {
  buckets: Record<PortfolioBucket, number>;
  projects: Array<{ id: string; name: string; projectNumber: string; status: string; bucket: PortfolioBucket }>;
}

export interface OutstandingQuotations {
  count: number;
  totalValue: number;
  quotations: Array<{ id: string; quotationNumber: string; status: string; value: number; agingDays: number }>;
}

export interface PendingApproval {
  approvalRequestId: string;
  entityType: string;
  entityId: string;
  createdAt: string;
}

export interface OpenProcurementRow {
  status: string;
  count: number;
  totalValue: number;
}

export interface OutstandingClaims {
  count: number;
  totalValue: number;
  claims: Array<{
    id: string;
    claimNumber: string;
    claimType: string;
    status: string;
    netClaimAmount: number;
    agingDays: number;
  }>;
}

export interface CostCategoryRow {
  costCategory: string;
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

export interface CashFlowApproximation {
  inflow: number;
  outflow: number;
  outflowBreakdown: { purchaseOrders: number; payroll: number };
  net: number;
}

export interface AttendanceSnapshot {
  date: string;
  clockedInCount: number;
}

export interface ActivityEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  actorUser: { id: string; fullName: string } | null;
}

export const dashboardApi = {
  getPortfolio: () => api.get<PortfolioSummary>('/dashboard/portfolio'),
  getOutstandingQuotations: () => api.get<OutstandingQuotations>('/dashboard/quotations'),
  getMyPendingApprovals: () => api.get<PendingApproval[]>('/dashboard/my-approvals'),
  getOpenProcurement: () => api.get<OpenProcurementRow[]>('/dashboard/procurement'),
  getOutstandingClaims: () => api.get<OutstandingClaims>('/dashboard/claims'),
  getCostingRollup: () => api.get<CostingDashboard>('/dashboard/costing'),
  getCashFlow: () => api.get<CashFlowApproximation>('/dashboard/cash-flow'),
  getAttendance: () => api.get<AttendanceSnapshot>('/dashboard/attendance'),
  getActivity: () => api.get<ActivityEntry[]>('/dashboard/activity'),
};
