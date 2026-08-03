import { api, toQueryString, type PaginatedResult } from '../../lib/api-client';

export interface Customer {
  id: string;
  name: string;
  registrationNumber: string | null;
  industry: string | null;
  billingAddress: string | null;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface CustomerInput {
  name: string;
  registrationNumber?: string;
  industry?: string;
  billingAddress?: string;
  status?: Customer['status'];
}

export interface QueryCustomers {
  page?: number;
  pageSize?: number;
  status?: string;
  search?: string;
}

export const customersApi = {
  list: (query: QueryCustomers) => api.get<PaginatedResult<Customer>>(`/customers${toQueryString(query)}`),
  create: (input: CustomerInput) => api.post<Customer>('/customers', input),
  update: (id: string, input: Partial<CustomerInput>) => api.patch<Customer>(`/customers/${id}`, input),
  remove: (id: string) => api.delete<void>(`/customers/${id}`),
};
