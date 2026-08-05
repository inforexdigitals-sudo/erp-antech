import { api, toQueryString, type PaginatedResult } from '../../lib/api-client';
import type { CostCategory } from '../shared/constants';

export type VariationOrderCause = 'client_instruction' | 'site_condition' | 'design_change' | 'other';
export type VariationOrderStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'client_signoff_pending' | 'client_approved';

export interface VariationOrderItem {
  id: string;
  description: string;
  unit: string | null;
  quantity: string | null;
  unitCost: string | null;
  unitPrice: string | null;
  costCategory: CostCategory;
}

export interface VariationOrderRevision {
  id: string;
  revisionNumber: number;
  costImpact: string;
  revenueImpact: string;
  notes: string | null;
  createdAt: string;
}

export interface VariationOrder {
  id: string;
  voNumber: string;
  title: string;
  cause: VariationOrderCause;
  status: VariationOrderStatus;
  costImpact: string;
  revenueImpact: string;
  scheduleImpactDays: number | null;
  createdAt: string;
  items: VariationOrderItem[];
  revisions: VariationOrderRevision[];
  requester: { id: string; fullName: string };
  approver: { id: string; fullName: string } | null;
  project: { id: string; name: string; projectNumber: string };
}

export interface VoItemInput {
  description: string;
  unit?: string;
  quantity?: number;
  unitCost?: number;
  unitPrice?: number;
  costCategory: CostCategory;
}

export interface CreateVariationOrderInput {
  projectId: string;
  title: string;
  cause: VariationOrderCause;
  scheduleImpactDays?: number;
  items: VoItemInput[];
}

export interface UpdateVariationOrderHeaderInput {
  title?: string;
  cause?: VariationOrderCause;
  scheduleImpactDays?: number;
}

export interface QueryVariationOrders {
  page?: number;
  pageSize?: number;
  status?: string;
  projectId?: string;
}

export const variationOrdersApi = {
  list: (query: QueryVariationOrders) => api.get<PaginatedResult<VariationOrder>>(`/variation-orders${toQueryString(query)}`),
  get: (id: string) => api.get<VariationOrder>(`/variation-orders/${id}`),
  create: (input: CreateVariationOrderInput) => api.post<VariationOrder>('/variation-orders', input),
  updateHeader: (id: string, input: UpdateVariationOrderHeaderInput) =>
    api.patch<VariationOrder>(`/variation-orders/${id}`, input),
  addRevision: (id: string, input: { notes?: string; items: VoItemInput[] }) =>
    api.post<VariationOrder>(`/variation-orders/${id}/revisions`, input),
  submitForApproval: (id: string) => api.post<VariationOrder>(`/variation-orders/${id}/submit-for-approval`),
  approve: (id: string) => api.post<VariationOrder>(`/variation-orders/${id}/approve`, {}),
  reject: (id: string) => api.post<VariationOrder>(`/variation-orders/${id}/reject`, {}),
  requestClientSignoff: (id: string) => api.post<VariationOrder>(`/variation-orders/${id}/request-client-signoff`),
  clientSignoff: (id: string) => api.post<VariationOrder>(`/variation-orders/${id}/client-signoff`),
};
