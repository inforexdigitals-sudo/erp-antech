import { api, uploadFile } from '../../lib/api-client';

export interface CompanyProfile {
  id: string;
  name: string;
  legalName: string | null;
  registrationNumber: string | null;
  logoUrl: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateProvince: string | null;
  postalCode: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  description1: string | null;
  description2: string | null;
  baseCurrency: string;
  countryCode: string;
  hasLogo: boolean;
}

export interface UpdateCompanyProfileInput {
  name?: string;
  legalName?: string;
  registrationNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  website?: string;
  description1?: string;
  description2?: string;
}

export const companyApi = {
  getProfile: () => api.get<CompanyProfile>('/company/profile'),
  updateProfile: (input: UpdateCompanyProfileInput) => api.patch<CompanyProfile>('/company/profile', input),
  uploadLogo: (file: File) => uploadFile<CompanyProfile>('/company/logo', file),
};
