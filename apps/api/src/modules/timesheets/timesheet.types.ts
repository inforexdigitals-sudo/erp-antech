/** Matches the CHECK constraint on timesheets.status (db/migrations/0010). */
export const TIMESHEET_STATUSES = ['draft', 'submitted', 'approved', 'rejected'] as const;
export type TimesheetStatus = (typeof TIMESHEET_STATUSES)[number];

/** Matches the CHECK constraint on leave_requests.status (db/migrations/0010). */
export const LEAVE_REQUEST_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const;
export type LeaveRequestStatus = (typeof LEAVE_REQUEST_STATUSES)[number];

/**
 * Daily overtime threshold used by ClockOut to split totalHours into
 * regular vs. overtime. FR-11.4 wants this "configurable" (daily/weekly
 * threshold); there's no Settings-driven config for it yet, so this is
 * a hardcoded default, not a real rule engine — flagged, not hidden.
 */
export const DEFAULT_DAILY_OVERTIME_THRESHOLD_HOURS = 8;
