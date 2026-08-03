import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreateMaterialRequestInput, materialRequestsApi, QueryMaterialRequests } from './material-requests-api';
import { CreateRfqInput, QueryRfqs, RecordRfqResponseInput, rfqsApi } from './rfqs-api';

export function useMaterialRequests(query: QueryMaterialRequests) {
  return useQuery({ queryKey: ['material-requests', query], queryFn: () => materialRequestsApi.list(query) });
}

export function useMaterialRequest(id: string | undefined) {
  return useQuery({ queryKey: ['material-requests', id], queryFn: () => materialRequestsApi.get(id!), enabled: !!id });
}

export function useCreateMaterialRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMaterialRequestInput) => materialRequestsApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['material-requests'] }),
  });
}

export function useMaterialRequestActions(id: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['material-requests'] });
  return {
    submitForApproval: useMutation({ mutationFn: () => materialRequestsApi.submitForApproval(id), onSuccess: invalidate }),
    approve: useMutation({ mutationFn: () => materialRequestsApi.approve(id), onSuccess: invalidate }),
    reject: useMutation({ mutationFn: () => materialRequestsApi.reject(id), onSuccess: invalidate }),
  };
}

export function useRfqs(query: QueryRfqs) {
  return useQuery({ queryKey: ['rfqs', query], queryFn: () => rfqsApi.list(query) });
}

export function useRfq(id: string | undefined) {
  return useQuery({ queryKey: ['rfqs', id], queryFn: () => rfqsApi.get(id!), enabled: !!id });
}

export function useCreateRfq() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRfqInput) => rfqsApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rfqs'] }),
  });
}

export function useRfqActions(id: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['rfqs'] });
  return {
    addRecipients: useMutation({ mutationFn: (supplierIds: string[]) => rfqsApi.addRecipients(id, supplierIds), onSuccess: invalidate }),
    send: useMutation({ mutationFn: () => rfqsApi.send(id), onSuccess: invalidate }),
    recordResponse: useMutation({ mutationFn: (input: RecordRfqResponseInput) => rfqsApi.recordResponse(id, input), onSuccess: invalidate }),
    selectResponse: useMutation({ mutationFn: (responseId: string) => rfqsApi.selectResponse(id, responseId), onSuccess: invalidate }),
  };
}
