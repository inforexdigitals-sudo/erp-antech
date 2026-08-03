import { titleCase } from '../../lib/utils';
import { Pill, type PillTone } from './Pill';

/**
 * One tone map per module's status enum, all in one place so a new
 * status value added to the backend fails loud (falls back to
 * 'neutral' + the raw code via titleCase) instead of silently
 * rendering nothing.
 */
export const STATUS_TONES: Record<string, Record<string, PillTone>> = {
  directory_entity: {
    active: 'success',
    inactive: 'neutral',
    blacklisted: 'critical',
  },
  quotation: {
    draft: 'neutral',
    pending_approval: 'warning',
    approved: 'info',
    sent: 'info',
    accepted: 'success',
    rejected: 'critical',
    expired: 'critical',
    converted: 'success',
  },
  project: {
    planning: 'neutral',
    active: 'info',
    on_hold: 'warning',
    completed: 'success',
    closed: 'success',
    cancelled: 'critical',
  },
  purchase_order: {
    draft: 'neutral',
    pending_approval: 'warning',
    approved: 'info',
    rejected: 'critical',
    issued: 'info',
    partially_received: 'warning',
    received: 'success',
    closed: 'success',
    cancelled: 'critical',
  },
  material_request: {
    draft: 'neutral',
    submitted: 'warning',
    under_review: 'warning',
    approved: 'info',
    rejected: 'critical',
    converted_to_po: 'success',
  },
  rfq: {
    draft: 'neutral',
    sent: 'info',
    responses_received: 'warning',
    closed: 'success',
  },
  claim: {
    draft: 'neutral',
    submitted: 'warning',
    under_review: 'warning',
    certified: 'success',
    rejected: 'critical',
    paid: 'success',
  },
  variation_order: {
    draft: 'neutral',
    pending_approval: 'warning',
    approved: 'info',
    rejected: 'critical',
    client_signoff_pending: 'warning',
    client_approved: 'success',
  },
  invoice: {
    draft: 'neutral',
    sent: 'info',
    partially_paid: 'warning',
    paid: 'success',
    overdue: 'critical',
    void: 'critical',
  },
  timesheet: {
    draft: 'neutral',
    submitted: 'warning',
    approved: 'success',
    rejected: 'critical',
  },
  leave_request: {
    pending: 'warning',
    approved: 'success',
    rejected: 'critical',
    cancelled: 'neutral',
  },
  payroll_period: {
    open: 'neutral',
    processing: 'warning',
    exported: 'info',
    closed: 'success',
  },
};

export function StatusPill({ domain, status }: { domain: keyof typeof STATUS_TONES; status: string }) {
  const tone = STATUS_TONES[domain]?.[status] ?? 'neutral';
  return <Pill tone={tone}>{titleCase(status)}</Pill>;
}
