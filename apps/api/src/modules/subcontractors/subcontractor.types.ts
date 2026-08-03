/** Matches the CHECK constraint on subcontractors.status (db/migrations/0005). */
export const SUBCONTRACTOR_STATUSES = ['active', 'inactive', 'blacklisted'] as const;
export type SubcontractorStatus = (typeof SUBCONTRACTOR_STATUSES)[number];
