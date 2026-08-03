import { api, toQueryString, type PaginatedResult } from '../../lib/api-client';

export type TimesheetStatus = 'draft' | 'submitted' | 'approved' | 'rejected';
export type LeaveRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface Timesheet {
  id: string;
  userId: string;
  workDate: string;
  clockIn: string | null;
  clockOut: string | null;
  totalHours: string;
  overtimeHours: string;
  status: TimesheetStatus;
  user?: { id: string; fullName: string };
  allocations: Array<{ id: string; projectId: string; hours: string; project: { id: string; name: string; projectNumber: string } }>;
}

export interface QueryTimesheets {
  page?: number;
  pageSize?: number;
  status?: string;
  userId?: string;
}

export const timesheetsApi = {
  list: (query: QueryTimesheets) => api.get<PaginatedResult<Timesheet>>(`/timesheets${toQueryString(query)}`),
  get: (id: string) => api.get<Timesheet>(`/timesheets/${id}`),
  clockIn: (input: { lat?: number; lng?: number }) => api.post<Timesheet>('/timesheets/clock-in', input),
  clockOut: (input: { lat?: number; lng?: number }) => api.post<Timesheet>('/timesheets/clock-out', input),
  createManual: (input: { workDate: string; totalHours: number; overtimeHours?: number }) =>
    api.post<Timesheet>('/timesheets/manual', input),
  allocateHours: (id: string, allocations: Array<{ projectId: string; hours: number }>) =>
    api.post<Timesheet>(`/timesheets/${id}/allocations`, { allocations }),
  submitForApproval: (id: string) => api.post<Timesheet>(`/timesheets/${id}/submit-for-approval`),
  approve: (id: string) => api.post<Timesheet>(`/timesheets/${id}/approve`, {}),
  reject: (id: string) => api.post<Timesheet>(`/timesheets/${id}/reject`, {}),
};

export interface LeaveType {
  id: string;
  name: string;
  isPaid: boolean;
  annualEntitlementDays: string;
}

export interface LeaveRequest {
  id: string;
  startDate: string;
  endDate: string;
  days: string;
  status: LeaveRequestStatus;
  reason: string | null;
  createdAt: string;
  leaveType: LeaveType;
  user: { id: string; fullName: string };
}

export interface QueryLeaveRequests {
  page?: number;
  pageSize?: number;
  status?: string;
  userId?: string;
}

export const leaveApi = {
  listTypes: () => api.get<LeaveType[]>('/leave-types'),
  createType: (input: { name: string; isPaid?: boolean; annualEntitlementDays?: number }) =>
    api.post<LeaveType>('/leave-types', input),
  list: (query: QueryLeaveRequests) => api.get<PaginatedResult<LeaveRequest>>(`/leave-requests${toQueryString(query)}`),
  create: (input: { leaveTypeId: string; startDate: string; endDate: string; days: number; reason?: string }) =>
    api.post<LeaveRequest>('/leave-requests', input),
  approve: (id: string) => api.post<LeaveRequest>(`/leave-requests/${id}/approve`),
  reject: (id: string) => api.post<LeaveRequest>(`/leave-requests/${id}/reject`),
};
