/** Matches the CHECK constraint on payroll_periods.status (db/migrations/0010). */
export const PAYROLL_PERIOD_STATUSES = ['open', 'processing', 'exported', 'closed'] as const;
export type PayrollPeriodStatus = (typeof PAYROLL_PERIOD_STATUSES)[number];

/** Matches the CHECK constraint on payroll_exports.format (db/migrations/0010). */
export const PAYROLL_EXPORT_FORMATS = ['csv', 'api'] as const;
export type PayrollExportFormat = (typeof PAYROLL_EXPORT_FORMATS)[number];

/** Matches the CHECK constraint on statutory_contribution_rules.scheme (db/migrations/0010). */
export const STATUTORY_SCHEMES = ['CPF', 'EPF', 'SOCSO'] as const;
export type StatutoryScheme = (typeof STATUTORY_SCHEMES)[number];
