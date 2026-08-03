import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customersApi, CustomerInput, QueryCustomers } from './api';

/** Invalidates both this page's list and the shared picker other modules use (features/shared/hooks.ts's useCustomers). */
function invalidateCustomers(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['customers'] });
}

export function useCustomersList(query: QueryCustomers) {
  return useQuery({ queryKey: ['customers', 'list', query], queryFn: () => customersApi.list(query) });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CustomerInput) => customersApi.create(input),
    onSuccess: () => invalidateCustomers(qc),
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CustomerInput> }) => customersApi.update(id, input),
    onSuccess: () => invalidateCustomers(qc),
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customersApi.remove(id),
    onSuccess: () => invalidateCustomers(qc),
  });
}
