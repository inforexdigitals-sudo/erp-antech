import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { documentsApi, QueryDocuments } from './api';

export function useDocuments(query: QueryDocuments) {
  return useQuery({ queryKey: ['documents', query], queryFn: () => documentsApi.list(query) });
}

export function useDocument(id: string | undefined) {
  return useQuery({ queryKey: ['documents', id], queryFn: () => documentsApi.get(id!), enabled: !!id });
}

export function useCreateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { folderId?: string; relatedEntityType: string; relatedEntityId: string; fileName: string; mimeType: string; sizeBytes: number }) =>
      documentsApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
}

export function useAddDocumentVersion(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { fileName?: string; mimeType: string; sizeBytes: number }) => documentsApi.addVersion(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
}
