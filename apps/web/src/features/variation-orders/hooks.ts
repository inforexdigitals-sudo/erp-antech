import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreateVariationOrderInput, QueryVariationOrders, UpdateVariationOrderHeaderInput, variationOrdersApi, VoItemInput } from './api';

export function useVariationOrders(query: QueryVariationOrders) {
  return useQuery({ queryKey: ['variation-orders', query], queryFn: () => variationOrdersApi.list(query) });
}

export function useVariationOrder(id: string | undefined) {
  return useQuery({ queryKey: ['variation-orders', id], queryFn: () => variationOrdersApi.get(id!), enabled: !!id });
}

export function useCreateVariationOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateVariationOrderInput) => variationOrdersApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['variation-orders'] }),
  });
}

export function useAddVoRevision(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { notes?: string; items: VoItemInput[] }) => variationOrdersApi.addRevision(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['variation-orders'] }),
  });
}

export function useVariationOrderActions(id: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['variation-orders'] });
  return {
    updateHeader: useMutation({
      mutationFn: (input: UpdateVariationOrderHeaderInput) => variationOrdersApi.updateHeader(id, input),
      onSuccess: invalidate,
    }),
    submitForApproval: useMutation({ mutationFn: () => variationOrdersApi.submitForApproval(id), onSuccess: invalidate }),
    approve: useMutation({ mutationFn: () => variationOrdersApi.approve(id), onSuccess: invalidate }),
    reject: useMutation({ mutationFn: () => variationOrdersApi.reject(id), onSuccess: invalidate }),
    requestClientSignoff: useMutation({ mutationFn: () => variationOrdersApi.requestClientSignoff(id), onSuccess: invalidate }),
    clientSignoff: useMutation({ mutationFn: () => variationOrdersApi.clientSignoff(id), onSuccess: invalidate }),
  };
}
