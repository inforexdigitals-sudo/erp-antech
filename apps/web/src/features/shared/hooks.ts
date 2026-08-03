import { useQuery } from '@tanstack/react-query';
import { sharedApi } from './api';

const STALE_TIME = 60_000;

export function useCustomers() {
  return useQuery({ queryKey: ['customers'], queryFn: sharedApi.listCustomers, staleTime: STALE_TIME });
}

export function usePickerUsers() {
  return useQuery({ queryKey: ['users', 'picker'], queryFn: sharedApi.listUsers, staleTime: STALE_TIME });
}

export function usePickerProjects() {
  return useQuery({ queryKey: ['projects', 'picker'], queryFn: sharedApi.listProjectsForPicker, staleTime: STALE_TIME });
}

export function usePickerSuppliers() {
  return useQuery({ queryKey: ['suppliers', 'picker'], queryFn: sharedApi.listSuppliersForPicker, staleTime: STALE_TIME });
}

export function usePickerSubcontractors() {
  return useQuery({
    queryKey: ['subcontractors', 'picker'],
    queryFn: sharedApi.listSubcontractorsForPicker,
    staleTime: STALE_TIME,
  });
}
