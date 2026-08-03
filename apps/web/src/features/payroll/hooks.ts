import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PayrollExportLineInput, payrollApi } from './api';

export function usePayrollPeriods() {
  return useQuery({ queryKey: ['payroll-periods'], queryFn: payrollApi.listPeriods });
}

export function usePayrollPeriod(id: string | undefined) {
  return useQuery({ queryKey: ['payroll-periods', id], queryFn: () => payrollApi.getPeriod(id!), enabled: !!id });
}

export function usePayrollPreview(id: string | undefined) {
  return useQuery({ queryKey: ['payroll-periods', id, 'preview'], queryFn: () => payrollApi.preview(id!), enabled: !!id });
}

export function useCreatePayrollPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { periodStart: string; periodEnd: string }) => payrollApi.createPeriod(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payroll-periods'] }),
  });
}

export function useGeneratePayrollExport(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lines: PayrollExportLineInput[]) => payrollApi.generateExport(id, { lines }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll-periods'] });
    },
  });
}

export function useStatutoryRules() {
  return useQuery({ queryKey: ['statutory-rules'], queryFn: payrollApi.listRules });
}

export function useCreateStatutoryRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof payrollApi.createRule>[0]) => payrollApi.createRule(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['statutory-rules'] }),
  });
}
