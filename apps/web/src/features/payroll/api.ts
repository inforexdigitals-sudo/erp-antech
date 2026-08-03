import { api } from '../../lib/api-client';

export type PayrollPeriodStatus = 'open' | 'processing' | 'exported' | 'closed';
export type StatutoryScheme = 'CPF' | 'EPF' | 'SOCSO';

export interface PayrollPeriod {
  id: string;
  periodStart: string;
  periodEnd: string;
  status: PayrollPeriodStatus;
  createdAt: string;
}

export interface PayrollExportLine {
  id: string;
  userId: string;
  regularHours: string;
  overtimeHours: string;
  allowances: string;
  deductions: string;
  statutoryEmployeeContribution: string;
  statutoryEmployerContribution: string;
  netPay: string;
}

export interface PayrollExport {
  id: string;
  exportedAt: string;
  format: 'csv' | 'api';
  fileReference: string | null;
  lines: PayrollExportLine[];
  exporter: { id: string; fullName: string };
}

export interface PayrollPeriodWithDetail extends PayrollPeriod {
  exports: PayrollExport[];
}

export interface PreviewRow {
  userId: string;
  regularHours: number;
  overtimeHours: number;
}

export interface PayrollExportLineInput {
  userId: string;
  allowances?: number;
  deductions?: number;
  statutoryEmployeeContribution?: number;
  statutoryEmployerContribution?: number;
  netPay: number;
}

export interface StatutoryContributionRule {
  id: string;
  countryCode: string;
  scheme: StatutoryScheme;
  ageBand: string | null;
  employeeRate: string;
  employerRate: string;
  salaryCeiling: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export const payrollApi = {
  listPeriods: () => api.get<PayrollPeriod[]>('/payroll/periods'),
  getPeriod: (id: string) => api.get<PayrollPeriodWithDetail>(`/payroll/periods/${id}`),
  createPeriod: (input: { periodStart: string; periodEnd: string }) => api.post<PayrollPeriod>('/payroll/periods', input),
  preview: (id: string) => api.get<PreviewRow[]>(`/payroll/periods/${id}/preview`),
  generateExport: (id: string, input: { format?: 'csv' | 'api'; lines: PayrollExportLineInput[] }) =>
    api.post<PayrollPeriodWithDetail>(`/payroll/periods/${id}/exports`, input),
  downloadLatestCsv: (id: string) => api.get<string>(`/payroll/periods/${id}/exports/latest.csv`),

  listRules: () => api.get<StatutoryContributionRule[]>('/statutory-contribution-rules'),
  createRule: (input: {
    countryCode: string;
    scheme: StatutoryScheme;
    ageBand?: string;
    employeeRate: number;
    employerRate: number;
    salaryCeiling?: number;
    effectiveFrom: string;
    effectiveTo?: string;
  }) => api.post<StatutoryContributionRule>('/statutory-contribution-rules', input),
};
