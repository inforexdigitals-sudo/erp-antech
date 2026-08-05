import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreatePurchaseOrderInput, purchaseOrdersApi, QueryPurchaseOrders, UpdatePurchaseOrderInput } from './api';

export function usePurchaseOrders(query: QueryPurchaseOrders) {
  return useQuery({ queryKey: ['purchase-orders', query], queryFn: () => purchaseOrdersApi.list(query) });
}

export function usePurchaseOrder(id: string | undefined) {
  return useQuery({ queryKey: ['purchase-orders', id], queryFn: () => purchaseOrdersApi.get(id!), enabled: !!id });
}

export function useCreatePurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePurchaseOrderInput) => purchaseOrdersApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchase-orders'] }),
  });
}

export function usePurchaseOrderActions(id: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['purchase-orders'] });
  return {
    update: useMutation({ mutationFn: (input: UpdatePurchaseOrderInput) => purchaseOrdersApi.update(id, input), onSuccess: invalidate }),
    submitForApproval: useMutation({ mutationFn: () => purchaseOrdersApi.submitForApproval(id), onSuccess: invalidate }),
    approve: useMutation({ mutationFn: () => purchaseOrdersApi.approve(id), onSuccess: invalidate }),
    reject: useMutation({ mutationFn: () => purchaseOrdersApi.reject(id), onSuccess: invalidate }),
    issue: useMutation({ mutationFn: () => purchaseOrdersApi.issue(id), onSuccess: invalidate }),
    cancel: useMutation({ mutationFn: (comments?: string) => purchaseOrdersApi.cancel(id, comments), onSuccess: invalidate }),
    recordDelivery: useMutation({
      mutationFn: (input: { deliveryDate: string; notes?: string; items: Array<{ purchaseOrderItemId: string; quantityReceived: number }> }) =>
        purchaseOrdersApi.recordDelivery(id, input),
      onSuccess: invalidate,
    }),
  };
}
