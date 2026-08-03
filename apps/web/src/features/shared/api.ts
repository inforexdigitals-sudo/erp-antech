import { api, type PaginatedResult } from '../../lib/api-client';

export interface Customer {
  id: string;
  name: string;
  registrationNumber: string | null;
  industry: string | null;
  status: string;
}

export interface PickerUser {
  id: string;
  fullName: string;
  jobTitle: string | null;
}

export interface PickerProject {
  id: string;
  name: string;
  projectNumber: string;
}

export interface PickerSupplier {
  id: string;
  name: string;
  status: string;
  paymentTerms: string | null;
}

export interface PickerSubcontractor {
  id: string;
  name: string;
  status: string;
}

export const sharedApi = {
  /** `/customers` is now paginated (see features/customers/) — this unwraps it for the pickers Quotations/Projects/Claims use, matching listSuppliersForPicker/listSubcontractorsForPicker below. */
  listCustomers: () => api.get<PaginatedResult<Customer>>('/customers?pageSize=100').then((r) => r.data),
  listUsers: () => api.get<PickerUser[]>('/users'),
  /** Large pageSize so a picker gets "all of them" in one call without building a searchable async-select for what's still a small list at this stage. */
  listProjectsForPicker: () =>
    api.get<PaginatedResult<PickerProject>>('/projects?pageSize=100').then((r) => r.data),
  listSuppliersForPicker: () =>
    api.get<PaginatedResult<PickerSupplier>>('/suppliers?pageSize=100&status=active').then((r) => r.data),
  listSubcontractorsForPicker: () =>
    api.get<PaginatedResult<PickerSubcontractor>>('/subcontractors?pageSize=100&status=active').then((r) => r.data),
};
