import { api, uploadFile } from '../../lib/api-client';
import type { CreateProjectInput, Project } from '../projects/api';

export interface ImportedFileSummary {
  id: string;
  fileName: string;
  mimeType: string;
  extractedText: string | null;
  status: 'pending_review' | 'completed' | 'discarded';
  projectId: string | null;
  createdAt: string;
}

export interface ImportSuggestions {
  suggestedName: string;
  suggestedContractValue: number | null;
  suggestedStartDate: string | null;
  suggestedCustomerId: string | null;
  suggestedCustomerName: string | null;
  looksScanned: boolean;
}

export interface ExtractResult {
  import: ImportedFileSummary;
  suggestions: ImportSuggestions;
}

export const projectImportApi = {
  extract: (file: File) => uploadFile<ExtractResult>('/project-imports/extract', file),
  list: () => api.get<ImportedFileSummary[]>('/project-imports'),
  confirm: (id: string, input: CreateProjectInput) => api.post<Project>(`/project-imports/${id}/confirm`, input),
};
