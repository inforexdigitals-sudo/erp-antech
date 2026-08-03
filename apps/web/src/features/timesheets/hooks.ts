import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { leaveApi, QueryLeaveRequests, QueryTimesheets, timesheetsApi } from './api';

export function useTimesheets(query: QueryTimesheets) {
  return useQuery({ queryKey: ['timesheets', query], queryFn: () => timesheetsApi.list(query) });
}

export function useTimesheet(id: string | undefined) {
  return useQuery({ queryKey: ['timesheets', id], queryFn: () => timesheetsApi.get(id!), enabled: !!id });
}

export function useTimesheetActions() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['timesheets'] });
  return {
    clockIn: useMutation({ mutationFn: (input: { lat?: number; lng?: number }) => timesheetsApi.clockIn(input), onSuccess: invalidate }),
    clockOut: useMutation({ mutationFn: (input: { lat?: number; lng?: number }) => timesheetsApi.clockOut(input), onSuccess: invalidate }),
    createManual: useMutation({
      mutationFn: (input: { workDate: string; totalHours: number; overtimeHours?: number }) => timesheetsApi.createManual(input),
      onSuccess: invalidate,
    }),
  };
}

export function useTimesheetItemActions(id: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['timesheets'] });
  return {
    allocateHours: useMutation({
      mutationFn: (allocations: Array<{ projectId: string; hours: number }>) => timesheetsApi.allocateHours(id, allocations),
      onSuccess: invalidate,
    }),
    submitForApproval: useMutation({ mutationFn: () => timesheetsApi.submitForApproval(id), onSuccess: invalidate }),
    approve: useMutation({ mutationFn: () => timesheetsApi.approve(id), onSuccess: invalidate }),
    reject: useMutation({ mutationFn: () => timesheetsApi.reject(id), onSuccess: invalidate }),
  };
}

export function useLeaveTypes() {
  return useQuery({ queryKey: ['leave-types'], queryFn: leaveApi.listTypes });
}

export function useCreateLeaveType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; isPaid?: boolean; annualEntitlementDays?: number }) => leaveApi.createType(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leave-types'] }),
  });
}

export function useLeaveRequests(query: QueryLeaveRequests) {
  return useQuery({ queryKey: ['leave-requests', query], queryFn: () => leaveApi.list(query) });
}

export function useLeaveActions() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['leave-requests'] });
  return {
    create: useMutation({
      mutationFn: (input: { leaveTypeId: string; startDate: string; endDate: string; days: number; reason?: string }) =>
        leaveApi.create(input),
      onSuccess: invalidate,
    }),
    approve: useMutation({ mutationFn: (id: string) => leaveApi.approve(id), onSuccess: invalidate }),
    reject: useMutation({ mutationFn: (id: string) => leaveApi.reject(id), onSuccess: invalidate }),
  };
}
