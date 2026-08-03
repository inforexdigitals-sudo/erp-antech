/** Matches the CHECK constraint on quotations.status (db/migrations/0003). */
export const QUOTATION_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'sent',
  'accepted',
  'rejected',
  'expired',
  'converted',
] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];
