import { api, toQueryString, type PaginatedResult } from '../../lib/api-client';
import type { CostCategory } from '../shared/constants';

export type PurchaseOrderStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'issued'
  | 'partially_received'
  | 'received'
  | 'closed'
  | 'cancelled';

export interface PurchaseOrderItem {
  id: string;
  description: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
  quantityReceived: string;
  costCategory: CostCategory;
}

export interface PoDelivery {
  id: string;
  deliveryNumber: string;
  deliveryDate: string;
  status: 'pending' | 'partial' | 'complete';
  notes: string | null;
  items: Array<{ id: string; purchaseOrderItemId: string; quantityReceived: string }>;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  status: PurchaseOrderStatus;
  issueDate: string | null;
  expectedDeliveryDate: string | null;
  subtotal: string;
  taxAmount: string;
  total: string;
  paymentTerms: string | null;
  items: PurchaseOrderItem[];
  supplier: { id: string; name: string; paymentTerms: string | null };
  project: { id: string; name: string; projectNumber: string };
  deliveries: PoDelivery[];
}

export interface PoItemInput {
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  costCategory: CostCategory;
}

export interface CreatePurchaseOrderInput {
  supplierId: string;
  projectId: string;
  materialRequestId?: string;
  expectedDeliveryDate?: string;
  paymentTerms?: string;
  taxAmount?: number;
  items: PoItemInput[];
}

export interface QueryPurchaseOrders {
  page?: number;
  pageSize?: number;
  status?: string;
  projectId?: string;
  supplierId?: string;
}

export const purchaseOrdersApi = {
  list: (query: QueryPurchaseOrders) => api.get<PaginatedResult<PurchaseOrder>>(`/purchase-orders${toQueryString(query)}`),
  get: (id: string) => api.get<PurchaseOrder>(`/purchase-orders/${id}`),
  create: (input: CreatePurchaseOrderInput) => api.post<PurchaseOrder>('/purchase-orders', input),
  submitForApproval: (id: string) => api.post<PurchaseOrder>(`/purchase-orders/${id}/submit-for-approval`),
  approve: (id: string) => api.post<PurchaseOrder>(`/purchase-orders/${id}/approve`, {}),
  reject: (id: string) => api.post<PurchaseOrder>(`/purchase-orders/${id}/reject`, {}),
  issue: (id: string) => api.post<PurchaseOrder>(`/purchase-orders/${id}/issue`),
  cancel: (id: string, comments?: string) => api.post<PurchaseOrder>(`/purchase-orders/${id}/cancel`, { comments }),
  recordDelivery: (
    id: string,
    input: { deliveryDate: string; notes?: string; items: Array<{ purchaseOrderItemId: string; quantityReceived: number }> },
  ) => api.post<PurchaseOrder>(`/purchase-orders/${id}/deliveries`, input),
};
