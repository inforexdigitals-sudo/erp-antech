import { api, toQueryString, type PaginatedResult } from '../../lib/api-client';

export interface Subcontractor {
  id: string;
  name: string;
  registrationNumber: string | null;
  trade: string | null;
  status: 'active' | 'inactive' | 'blacklisted';
  paymentTerms: string | null;
  createdAt: string;
}

export interface SubcontractorInput {
  name: string;
  registrationNumber?: string;
  trade?: string;
  status?: Subcontractor['status'];
  paymentTerms?: string;
}

export interface QuerySubcontractors {
  page?: number;
  pageSize?: number;
  status?: string;
  search?: string;
}

export const subcontractorsApi = {
  list: (query: QuerySubcontractors) =>
    api.get<PaginatedResult<Subcontractor>>(`/subcontractors${toQueryString(query)}`),
  create: (input: SubcontractorInput) => api.post<Subcontractor>('/subcontractors', input),
  update: (id: string, input: Partial<SubcontractorInput>) => api.patch<Subcontractor>(`/subcontractors/${id}`, input),
  remove: (id: string) => api.delete<void>(`/subcontractors/${id}`),
};
