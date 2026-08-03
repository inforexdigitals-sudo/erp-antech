/** Matches the CHECK constraint on claims.claim_type (db/migrations/0007). */
export const CLAIM_TYPES = ['client', 'subcontractor'] as const;
export type ClaimType = (typeof CLAIM_TYPES)[number];

/** Matches the CHECK constraint on claims.status (db/migrations/0007). */
export const CLAIM_STATUSES = ['draft', 'submitted', 'under_review', 'certified', 'rejected', 'paid'] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

/** Matches the CHECK constraint on retention_records.status (db/migrations/0007). */
export const RETENTION_STATUSES = ['held', 'partially_released', 'released'] as const;
export type RetentionStatus = (typeof RETENTION_STATUSES)[number];
