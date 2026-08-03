import { api, toQueryString, type PaginatedResult } from '../../lib/api-client';

export type MaterialRequestStatus = 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'converted_to_po';

export interface MaterialRequestItem {
  id: string;
  description: string;
  unit: string;
  quantity: string;
  estimatedUnitCost: string | null;
  notes: string | null;
}

export interface MaterialRequest {
  id: string;
  requestNumber: string;
  status: MaterialRequestStatus;
  neededByDate: string | null;
  notes: string | null;
  createdAt: string;
  items: MaterialRequestItem[];
  project: { id: string; name: string; projectNumber: string };
  requester: { id: string; fullName: string };
  approver: { id: string; fullName: string } | null;
}

export interface MaterialRequestItemInput {
  description: string;
  unit: string;
  quantity: number;
  estimatedUnitCost?: number;
}

export interface CreateMaterialRequestInput {
  projectId: string;
  neededByDate?: string;
  notes?: string;
  items: MaterialRequestItemInput[];
}

export interface QueryMaterialRequests {
  page?: number;
  pageSize?: number;
  status?: string;
  projectId?: string;
}

export const materialRequestsApi = {
  list: (query: QueryMaterialRequests) =>
    api.get<PaginatedResult<MaterialRequest>>(`/material-requests${toQueryString(query)}`),
  get: (id: string) => api.get<MaterialRequest>(`/material-requests/${id}`),
  create: (input: CreateMaterialRequestInput) => api.post<MaterialRequest>('/material-requests', input),
  submitForApproval: (id: string) => api.post<MaterialRequest>(`/material-requests/${id}/submit-for-approval`),
  approve: (id: string) => api.post<MaterialRequest>(`/material-requests/${id}/approve`, {}),
  reject: (id: string) => api.post<MaterialRequest>(`/material-requests/${id}/reject`, {}),
};
