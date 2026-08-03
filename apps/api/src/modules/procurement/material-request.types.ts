/** Matches the CHECK constraint on material_requests.status (db/migrations/0005). */
export const MATERIAL_REQUEST_STATUSES = [
  'draft',
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'converted_to_po',
] as const;
export type MaterialRequestStatus = (typeof MATERIAL_REQUEST_STATUSES)[number];
