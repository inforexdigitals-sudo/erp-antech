import { api, toQueryString, type PaginatedResult } from '../../lib/api-client';

export type ClaimType = 'client' | 'subcontractor';
export type ClaimStatus = 'draft' | 'submitted' | 'under_review' | 'certified' | 'rejected' | 'paid';

export interface ClaimItem {
  id: string;
  quotationItemId: string | null;
  description: string;
  contractQuantity: string | null;
  previousPercent: string;
  currentPercent: string;
  cumulativePercent: string;
  amount: string;
  /** Reference only (for showing/recomputing Amount when editing) — sourced from the linked BOQ line, null for a manually-added item. */
  quotationItem: { unit: string; unitPrice: string } | null;
}

export interface Claim {
  id: string;
  claimNumber: string;
  claimType: ClaimType;
  status: ClaimStatus;
  claimPeriodStart: string;
  claimPeriodEnd: string;
  cumulativePercentComplete: string | null;
  claimAmount: string;
  retentionPercent: string;
  retentionAmount: string;
  netClaimAmount: string;
  createdAt: string;
  items: ClaimItem[];
  project: { id: string; name: string; projectNumber: string };
  customer: { id: string; name: string } | null;
  subcontractor: { id: string; name: string } | null;
  paymentCertificate: { id: string; certificateNumber: string; amount: string } | null;
}

export interface ClaimItemInput {
  quotationItemId?: string;
  description: string;
  contractQuantity?: number;
  currentPercent: number;
  amount: number;
}

/** One line of the project's originating quotation — see GET /claims/boq-lines/:projectId. Used to prefill a new claim's BOQ Lines instead of retyping them every period. */
export interface BoqLine {
  quotationItemId: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  previousPercent: number;
}

export interface CreateClaimInput {
  projectId: string;
  claimType: ClaimType;
  customerId?: string;
  subcontractorId?: string;
  claimPeriodStart: string;
  claimPeriodEnd: string;
  retentionPercent?: number;
  items: ClaimItemInput[];
}

/** Only while a claim is still 'draft' — see ClaimsService.update. Items, when given, replace the claim's BOQ lines wholesale, same as create. */
export interface UpdateClaimInput {
  claimPeriodStart?: string;
  claimPeriodEnd?: string;
  retentionPercent?: number;
  items?: ClaimItemInput[];
}

export interface QueryClaims {
  page?: number;
  pageSize?: number;
  status?: string;
  projectId?: string;
}

export const claimsApi = {
  list: (query: QueryClaims) => api.get<PaginatedResult<Claim>>(`/claims${toQueryString(query)}`),
  get: (id: string) => api.get<Claim>(`/claims/${id}`),
  getBoqLines: (projectId: string) => api.get<BoqLine[]>(`/claims/boq-lines/${projectId}`),
  create: (input: CreateClaimInput) => api.post<Claim>('/claims', input),
  update: (id: string, input: UpdateClaimInput) => api.patch<Claim>(`/claims/${id}`, input),
  submitForApproval: (id: string) => api.post<Claim>(`/claims/${id}/submit-for-approval`),
  certify: (id: string) => api.post<Claim>(`/claims/${id}/certify`, {}),
  reject: (id: string) => api.post<Claim>(`/claims/${id}/reject`, {}),
};
