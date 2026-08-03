import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invoicesApi, QueryInvoices } from './api';

export function useInvoices(query: QueryInvoices) {
  return useQuery({ queryKey: ['invoices', query], queryFn: () => invoicesApi.list(query) });
}

export function useInvoice(id: string | undefined) {
  return useQuery({ queryKey: ['invoices', id], queryFn: () => invoicesApi.get(id!), enabled: !!id });
}

export function useCreateInvoiceFromClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ claimId, input }: { claimId: string; input: { dueDate?: string; taxAmount?: number } }) =>
      invoicesApi.createFromClaim(claimId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['claims'] });
    },
  });
}

export function useInvoiceActions(id: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['invoices'] });
    qc.invalidateQueries({ queryKey: ['claims'] });
  };
  return {
    send: useMutation({ mutationFn: () => invoicesApi.send(id), onSuccess: invalidate }),
    void: useMutation({ mutationFn: () => invoicesApi.void(id), onSuccess: invalidate }),
    recordPayment: useMutation({
      mutationFn: (input: { amount: number; paymentDate?: string; method?: string; reference?: string }) =>
        invoicesApi.recordPayment(id, input),
      onSuccess: invalidate,
    }),
  };
}
