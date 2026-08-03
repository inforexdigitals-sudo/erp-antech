import { api, toQueryString, type PaginatedResult } from '../../lib/api-client';

export interface Supplier {
  id: string;
  name: string;
  registrationNumber: string | null;
  category: string | null;
  rating: string | null;
  status: 'active' | 'inactive' | 'blacklisted';
  paymentTerms: string | null;
  createdAt: string;
}

export interface SupplierInput {
  name: string;
  registrationNumber?: string;
  category?: string;
  status?: Supplier['status'];
  paymentTerms?: string;
}

export interface QuerySuppliers {
  page?: number;
  pageSize?: number;
  status?: string;
  search?: string;
}

export const suppliersApi = {
  list: (query: QuerySuppliers) =>
    api.get<PaginatedResult<Supplier>>(`/suppliers${toQueryString(query)}`),
  create: (input: SupplierInput) => api.post<Supplier>('/suppliers', input),
  update: (id: string, input: Partial<SupplierInput>) => api.patch<Supplier>(`/suppliers/${id}`, input),
  remove: (id: string) => api.delete<void>(`/suppliers/${id}`),
};
