import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from './api';

export function usePortfolio() {
  return useQuery({ queryKey: ['dashboard', 'portfolio'], queryFn: dashboardApi.getPortfolio });
}

export function useOutstandingQuotations() {
  return useQuery({ queryKey: ['dashboard', 'quotations'], queryFn: dashboardApi.getOutstandingQuotations });
}

export function useMyPendingApprovals() {
  return useQuery({ queryKey: ['dashboard', 'my-approvals'], queryFn: dashboardApi.getMyPendingApprovals });
}

export function useOpenProcurement() {
  return useQuery({ queryKey: ['dashboard', 'procurement'], queryFn: dashboardApi.getOpenProcurement });
}

export function useOutstandingClaims() {
  return useQuery({ queryKey: ['dashboard', 'claims'], queryFn: dashboardApi.getOutstandingClaims });
}

export function useCostingRollup() {
  return useQuery({ queryKey: ['dashboard', 'costing'], queryFn: dashboardApi.getCostingRollup });
}

export function useCashFlow() {
  return useQuery({ queryKey: ['dashboard', 'cash-flow'], queryFn: dashboardApi.getCashFlow });
}

export function useAttendance() {
  return useQuery({ queryKey: ['dashboard', 'attendance'], queryFn: dashboardApi.getAttendance });
}

export function useActivity() {
  return useQuery({ queryKey: ['dashboard', 'activity'], queryFn: dashboardApi.getActivity });
}
