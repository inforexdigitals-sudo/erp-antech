import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { claimsApi, CreateClaimInput, QueryClaims } from './api';

export function useClaims(query: QueryClaims) {
  return useQuery({ queryKey: ['claims', query], queryFn: () => claimsApi.list(query) });
}

export function useClaim(id: string | undefined) {
  return useQuery({ queryKey: ['claims', id], queryFn: () => claimsApi.get(id!), enabled: !!id });
}

export function useCreateClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateClaimInput) => claimsApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['claims'] }),
  });
}

export function useClaimActions(id: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['claims'] });
    qc.invalidateQueries({ queryKey: ['invoices'] });
  };
  return {
    submitForApproval: useMutation({ mutationFn: () => claimsApi.submitForApproval(id), onSuccess: invalidate }),
    certify: useMutation({ mutationFn: () => claimsApi.certify(id), onSuccess: invalidate }),
    reject: useMutation({ mutationFn: () => claimsApi.reject(id), onSuccess: invalidate }),
  };
}
