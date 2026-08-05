import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ConfirmImportInput } from './api';
import { projectImportApi } from './api';

export function useProjectImports() {
  return useQuery({ queryKey: ['project-imports'], queryFn: projectImportApi.list });
}

export function useExtractImport() {
  return useMutation({ mutationFn: (file: File) => projectImportApi.extract(file) });
}

export function useConfirmImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ConfirmImportInput }) => projectImportApi.confirm(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-imports'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}
