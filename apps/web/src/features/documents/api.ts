import { api, toQueryString, type PaginatedResult } from '../../lib/api-client';

export interface DocumentFolder {
  id: string;
  name: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  parentFolderId: string | null;
}

export interface DocumentVersion {
  id: string;
  versionNumber: number;
  storageKey: string;
  sizeBytes: number;
  createdAt: string;
}

export interface DocumentPermission {
  id: string;
  roleId: string | null;
  userId: string | null;
  permission: 'view' | 'edit' | 'delete';
}

export interface AppDocument {
  id: string;
  folderId: string | null;
  relatedEntityType: string;
  relatedEntityId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  currentVersionId: string | null;
  createdAt: string;
  versions: DocumentVersion[];
  permissions: DocumentPermission[];
  uploader: { id: string; fullName: string };
}

export interface QueryDocuments {
  page?: number;
  pageSize?: number;
  relatedEntityType?: string;
  relatedEntityId?: string;
  folderId?: string;
}

export const documentsApi = {
  listFolders: (query: { relatedEntityType?: string; relatedEntityId?: string }) =>
    api.get<DocumentFolder[]>(`/document-folders${toQueryString(query)}`),
  createFolder: (input: { name: string; relatedEntityType?: string; relatedEntityId?: string; parentFolderId?: string }) =>
    api.post<DocumentFolder>('/document-folders', input),

  list: (query: QueryDocuments) => api.get<PaginatedResult<AppDocument>>(`/documents${toQueryString(query)}`),
  get: (id: string) => api.get<AppDocument>(`/documents/${id}`),
  create: (input: { folderId?: string; relatedEntityType: string; relatedEntityId: string; fileName: string; mimeType: string; sizeBytes: number }) =>
    api.post<AppDocument>('/documents', input),
  addVersion: (id: string, input: { fileName?: string; mimeType: string; sizeBytes: number }) =>
    api.post<AppDocument>(`/documents/${id}/versions`, input),
  getDownloadUrl: (id: string) => api.get<{ url: string }>(`/documents/${id}/download-url`),
};
