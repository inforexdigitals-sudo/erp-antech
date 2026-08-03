import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QuerySubcontractors, SubcontractorInput, subcontractorsApi } from './api';

export function useSubcontractors(query: QuerySubcontractors) {
  return useQuery({ queryKey: ['subcontractors', query], queryFn: () => subcontractorsApi.list(query) });
}

export function useCreateSubcontractor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SubcontractorInput) => subcontractorsApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subcontractors'] }),
  });
}

export function useUpdateSubcontractor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<SubcontractorInput> }) => subcontractorsApi.update(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subcontractors'] }),
  });
}

export function useDeleteSubcontractor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => subcontractorsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subcontractors'] }),
  });
}
