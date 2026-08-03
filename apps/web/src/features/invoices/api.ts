import { api, toQueryString, type PaginatedResult } from '../../lib/api-client';

export type InvoiceStatus = 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'void';

export interface Payment {
  id: string;
  amount: string;
  paymentDate: string;
  method: string | null;
  reference: string | null;
  createdAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string | null;
  subtotal: string;
  taxAmount: string;
  total: string;
  amountPaid: string;
  project: { id: string; name: string; projectNumber: string };
  customer: { id: string; name: string };
  claim: { id: string; claimNumber: string } | null;
  payments: Payment[];
}

export interface QueryInvoices {
  page?: number;
  pageSize?: number;
  status?: string;
  projectId?: string;
  customerId?: string;
}

export const invoicesApi = {
  list: (query: QueryInvoices) => api.get<PaginatedResult<Invoice>>(`/invoices${toQueryString(query)}`),
  get: (id: string) => api.get<Invoice>(`/invoices/${id}`),
  createFromClaim: (claimId: string, input: { dueDate?: string; taxAmount?: number }) =>
    api.post<Invoice>(`/claims/${claimId}/invoice`, input),
  send: (id: string) => api.post<Invoice>(`/invoices/${id}/send`),
  void: (id: string) => api.post<Invoice>(`/invoices/${id}/void`),
  recordPayment: (id: string, input: { amount: number; paymentDate?: string; method?: string; reference?: string }) =>
    api.post<Invoice>(`/invoices/${id}/payments`, input),
};
