import { api, toQueryString, uploadFile, type PaginatedResult } from '../../lib/api-client';
import type { CostCategory } from '../shared/constants';

export type QuotationStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'sent'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'converted';

export interface QuotationItem {
  id: string;
  description: string;
  category: CostCategory;
  unit: string;
  quantity: string;
  unitCost: string;
  unitPrice: string;
  markupPercent: string;
  discountPercent: string;
  lineTotal: string;
  sortOrder: number;
}

export interface QuotationRevision {
  id: string;
  revisionNumber: number;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  markupPercent: string;
  total: string;
  notes: string | null;
  createdAt: string;
  items: QuotationItem[];
}

export interface Quotation {
  id: string;
  quotationNumber: string;
  title: string;
  status: QuotationStatus;
  validUntil: string | null;
  createdAt: string;
  currentRevision: QuotationRevision | null;
  customer: { id: string; name: string };
  owner: { id: string; fullName: string } | null;
}

export interface QuotationItemInput {
  description: string;
  category: CostCategory;
  unit: string;
  quantity: number;
  unitCost: number;
  unitPrice: number;
  markupPercent?: number;
  discountPercent?: number;
  sortOrder?: number;
}

/** What POST /quotations/import-items hands back — plain data to prefill the line-items table with, never saved until the quotation itself is submitted. */
export interface QuotationImportedItem {
  description: string;
  category: CostCategory;
  unit: string;
  quantity: number;
  unitCost: number;
  unitPrice: number;
}

export interface CreateQuotationInput {
  customerId: string;
  title: string;
  validUntil?: string;
  discountAmount?: number;
  notes?: string;
  items: QuotationItemInput[];
}

export interface CreateRevisionInput {
  discountAmount?: number;
  notes?: string;
  items: QuotationItemInput[];
}

export interface UpdateQuotationHeaderInput {
  title?: string;
  customerId?: string;
  validUntil?: string;
}

export interface QueryQuotations {
  page?: number;
  pageSize?: number;
  status?: string;
  customerId?: string;
}

export const quotationsApi = {
  list: (query: QueryQuotations) => api.get<PaginatedResult<Quotation>>(`/quotations${toQueryString(query)}`),
  get: (id: string) => api.get<Quotation>(`/quotations/${id}`),
  create: (input: CreateQuotationInput) => api.post<Quotation>('/quotations', input),
  importItems: (file: File) => uploadFile<QuotationImportedItem[]>('/quotations/import-items', file),
  updateHeader: (id: string, input: UpdateQuotationHeaderInput) => api.patch<Quotation>(`/quotations/${id}`, input),
  remove: (id: string) => api.delete<void>(`/quotations/${id}`),
  addRevision: (id: string, input: CreateRevisionInput) => api.post<Quotation>(`/quotations/${id}/revisions`, input),
  submitForApproval: (id: string) => api.post<Quotation>(`/quotations/${id}/submit-for-approval`),
  approve: (id: string, comments?: string) => api.post<Quotation>(`/quotations/${id}/approve`, { comments }),
  reject: (id: string, comments?: string) => api.post<Quotation>(`/quotations/${id}/reject`, { comments }),
  send: (id: string) => api.post<Quotation>(`/quotations/${id}/send`),
  customerAccept: (id: string) => api.post<Quotation>(`/quotations/${id}/customer-accept`),
  customerReject: (id: string) => api.post<Quotation>(`/quotations/${id}/customer-reject`),
  convertToProject: (id: string) => api.post<{ id: string }>(`/quotations/${id}/convert-to-project`),
};
