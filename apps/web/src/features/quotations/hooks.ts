import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreateQuotationInput, CreateRevisionInput, QueryQuotations, quotationsApi } from './api';

export function useQuotations(query: QueryQuotations) {
  return useQuery({ queryKey: ['quotations', query], queryFn: () => quotationsApi.list(query) });
}

export function useQuotation(id: string | undefined) {
  return useQuery({ queryKey: ['quotations', id], queryFn: () => quotationsApi.get(id!), enabled: !!id });
}

export function useCreateQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateQuotationInput) => quotationsApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotations'] }),
  });
}

export function useAddQuotationRevision(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRevisionInput) => quotationsApi.addRevision(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotations'] }),
  });
}

export function useQuotationActions(id: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['quotations'] });
  return {
    submitForApproval: useMutation({ mutationFn: () => quotationsApi.submitForApproval(id), onSuccess: invalidate }),
    approve: useMutation({ mutationFn: (comments?: string) => quotationsApi.approve(id, comments), onSuccess: invalidate }),
    reject: useMutation({ mutationFn: (comments?: string) => quotationsApi.reject(id, comments), onSuccess: invalidate }),
    send: useMutation({ mutationFn: () => quotationsApi.send(id), onSuccess: invalidate }),
    customerAccept: useMutation({ mutationFn: () => quotationsApi.customerAccept(id), onSuccess: invalidate }),
    customerReject: useMutation({ mutationFn: () => quotationsApi.customerReject(id), onSuccess: invalidate }),
    convertToProject: useMutation({ mutationFn: () => quotationsApi.convertToProject(id), onSuccess: invalidate }),
  };
}
