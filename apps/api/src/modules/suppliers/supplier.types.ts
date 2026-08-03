/** Matches the CHECK constraint on suppliers.status (db/migrations/0005). */
export const SUPPLIER_STATUSES = ['active', 'inactive', 'blacklisted'] as const;
export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number];
