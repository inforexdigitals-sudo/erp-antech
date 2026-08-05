import { api, uploadFile } from '../../lib/api-client';
import type { CreateQuotationInput } from '../quotations/api';
import type { Project } from '../projects/api';

export interface ImportedFileSummary {
  id: string;
  fileName: string;
  mimeType: string;
  extractedText: string | null;
  status: 'pending_review' | 'completed' | 'discarded';
  projectId: string | null;
  createdAt: string;
}

export interface ImportedLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface ImportSuggestions {
  suggestedName: string;
  suggestedContractValue: number | null;
  suggestedStartDate: string | null;
  suggestedCustomerId: string | null;
  suggestedCustomerName: string | null;
  looksScanned: boolean;
  suggestedItems: ImportedLineItem[];
}

export interface ExtractResult {
  import: ImportedFileSummary;
  suggestions: ImportSuggestions;
}

/** Confirm now creates a real (already-"converted") quotation behind the project — see QuotationsService.createHistoricalProject. Same shape as CreateQuotationInput. */
export type ConfirmImportInput = CreateQuotationInput;

export const projectImportApi = {
  extract: (file: File) => uploadFile<ExtractResult>('/project-imports/extract', file),
  list: () => api.get<ImportedFileSummary[]>('/project-imports'),
  confirm: (id: string, input: ConfirmImportInput) => api.post<Project>(`/project-imports/${id}/confirm`, input),
};
