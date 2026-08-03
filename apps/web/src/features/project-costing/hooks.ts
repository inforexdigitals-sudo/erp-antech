import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ManualBudgetLineInput, projectCostingApi } from './api';

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

export function useCostingActions(projectId: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['project-costing', projectId] });
  return {
    initFromQuotation: useMutation({ mutationFn: () => projectCostingApi.initFromQuotation(projectId), onSuccess: invalidate }),
    createManualBudget: useMutation({
      mutationFn: (lines: ManualBudgetLineInput[]) => projectCostingApi.createManualBudget(projectId, lines),
      onSuccess: invalidate,
    }),
  };
}
