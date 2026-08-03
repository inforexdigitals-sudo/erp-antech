import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QuerySuppliers, SupplierInput, suppliersApi } from './api';

export function useSuppliers(query: QuerySuppliers) {
  return useQuery({ queryKey: ['suppliers', query], queryFn: () => suppliersApi.list(query) });
}

export function useCreateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SupplierInput) => suppliersApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });
}

export function useUpdateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<SupplierInput> }) => suppliersApi.update(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });
}

export function useDeleteSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => suppliersApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });
}
