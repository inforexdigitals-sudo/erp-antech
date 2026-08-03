/** Matches the CHECK constraint on rfqs.status (db/migrations/0005). */
export const RFQ_STATUSES = ['draft', 'sent', 'responses_received', 'closed'] as const;
export type RfqStatus = (typeof RFQ_STATUSES)[number];

/** Matches the CHECK constraint on rfq_recipients.status (db/migrations/0005). */
export const RFQ_RECIPIENT_STATUSES = ['pending', 'sent', 'viewed', 'responded', 'declined'] as const;
export type RfqRecipientStatus = (typeof RFQ_RECIPIENT_STATUSES)[number];
