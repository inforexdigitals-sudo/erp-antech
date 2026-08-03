import { api, toQueryString, type PaginatedResult } from '../../lib/api-client';

export type ClaimType = 'client' | 'subcontractor';
export type ClaimStatus = 'draft' | 'submitted' | 'under_review' | 'certified' | 'rejected' | 'paid';

export interface ClaimItem {
  id: string;
  description: string;
  contractQuantity: string | null;
  previousPercent: string;
  currentPercent: string;
  cumulativePercent: string;
  amount: string;
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
  description: string;
  contractQuantity?: number;
  currentPercent: number;
  amount: number;
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

export interface QueryClaims {
  page?: number;
  pageSize?: number;
  status?: string;
  projectId?: string;
}

export const claimsApi = {
  list: (query: QueryClaims) => api.get<PaginatedResult<Claim>>(`/claims${toQueryString(query)}`),
  get: (id: string) => api.get<Claim>(`/claims/${id}`),
  create: (input: CreateClaimInput) => api.post<Claim>('/claims', input),
  submitForApproval: (id: string) => api.post<Claim>(`/claims/${id}/submit-for-approval`),
  certify: (id: string) => api.post<Claim>(`/claims/${id}/certify`, {}),
  reject: (id: string) => api.post<Claim>(`/claims/${id}/reject`, {}),
};
