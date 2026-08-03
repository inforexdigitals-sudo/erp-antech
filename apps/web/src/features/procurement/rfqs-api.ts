import { api, toQueryString, type PaginatedResult } from '../../lib/api-client';

export type RfqStatus = 'draft' | 'sent' | 'responses_received' | 'closed';

export interface RfqItem {
  id: string;
  description: string;
  unit: string;
  quantity: string;
}

export interface RfqRecipient {
  id: string;
  status: string;
  supplier: { id: string; name: string };
}

export interface RfqResponseItem {
  id: string;
  rfqItemId: string;
  unitPrice: string;
  quantity: string;
  lineTotal: string;
}

export interface RfqResponse {
  id: string;
  submittedAt: string;
  totalAmount: string | null;
  leadTimeDays: number | null;
  notes: string | null;
  isSelected: boolean;
  items: RfqResponseItem[];
  supplier: { id: string; name: string };
}

export interface Rfq {
  id: string;
  rfqNumber: string;
  status: RfqStatus;
  dueDate: string | null;
  createdAt: string;
  items: RfqItem[];
  recipients: RfqRecipient[];
  responses: RfqResponse[];
  project: { id: string; name: string; projectNumber: string } | null;
  materialRequest: { id: string; requestNumber: string } | null;
  creator: { id: string; fullName: string };
}

export interface RfqItemInput {
  description: string;
  unit: string;
  quantity: number;
}

export interface CreateRfqInput {
  materialRequestId?: string;
  projectId?: string;
  dueDate?: string;
  items: RfqItemInput[];
  supplierIds?: string[];
}

export interface RecordRfqResponseInput {
  supplierId: string;
  leadTimeDays?: number;
  notes?: string;
  items: Array<{ rfqItemId: string; unitPrice: number; quantity: number }>;
}

export interface QueryRfqs {
  page?: number;
  pageSize?: number;
  status?: string;
  projectId?: string;
}

export const rfqsApi = {
  list: (query: QueryRfqs) => api.get<PaginatedResult<Rfq>>(`/rfqs${toQueryString(query)}`),
  get: (id: string) => api.get<Rfq>(`/rfqs/${id}`),
  create: (input: CreateRfqInput) => api.post<Rfq>('/rfqs', input),
  addRecipients: (id: string, supplierIds: string[]) => api.post<Rfq>(`/rfqs/${id}/recipients`, { supplierIds }),
  send: (id: string) => api.post<Rfq>(`/rfqs/${id}/send`),
  recordResponse: (id: string, input: RecordRfqResponseInput) => api.post<Rfq>(`/rfqs/${id}/responses`, input),
  selectResponse: (id: string, responseId: string) => api.post<Rfq>(`/rfqs/${id}/responses/${responseId}/select`),
};
