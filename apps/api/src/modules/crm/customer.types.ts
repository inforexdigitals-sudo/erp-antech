/** Matches the CHECK constraint on customers.status (db/migrations/0002). */
export const CUSTOMER_STATUSES = ['active', 'inactive'] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];
