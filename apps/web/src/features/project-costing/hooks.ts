import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreateExpenseInput, ManualBudgetLineInput, projectCostingApi } from './api';

export function useProjectBudget(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-costing', projectId, 'budget'],
    queryFn: () => projectCostingApi.getBudget(projectId!),
    enabled: !!projectId,
    retry: false,
  });
}

export function useCostingDashboard(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-costing', projectId, 'dashboard'],
    queryFn: () => projectCostingApi.getDashboard(projectId!),
    enabled: !!projectId,
  });
}

export function useProjectExpenses(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-costing', projectId, 'expenses'],
    queryFn: () => projectCostingApi.listExpenses(projectId!),
    enabled: !!projectId,
  });
}

export function useCostingActions(projectId: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['project-costing', projectId] });
  return {
    initFromQuotation: useMutation({ mutationFn: () => projectCostingApi.initFromQuotation(projectId), onSuccess: invalidate }),
    createManualBudget: useMutation({
      mutationFn: (lines: ManualBudgetLineInput[]) => projectCostingApi.createManualBudget(projectId, lines),
      onSuccess: invalidate,
    }),
    createExpense: useMutation({
      mutationFn: (input: CreateExpenseInput) => projectCostingApi.createExpense(projectId, input),
      onSuccess: invalidate,
    }),
  };
}
