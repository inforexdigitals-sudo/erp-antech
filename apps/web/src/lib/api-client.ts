import { useAuthStore } from '../stores/auth-store';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3000/api/v1';

export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string;
  correlationId: string;
  details?: unknown;
}

/** Mirrors apps/api's AllExceptionsFilter response shape exactly (docs/phase-3-system-architecture/api-architecture.md §4). */
export class ApiError extends Error {
  statusCode: number;
  errorCode: string;
  correlationId: string;
  details?: unknown;

  constructor(body: ApiErrorBody) {
    // Falls back rather than surfacing an empty string — a response
    // that doesn't match AllExceptionsFilter's shape (a proxy/gateway
    // in front of the real API, a misconfigured environment) should
    // still show the user *something*, not silently blank out the
    // error message and leave them staring at a form with no
    // indication anything went wrong.
    super(body.message || `Request failed (${body.statusCode ?? 'unknown status'}).`);
    this.name = 'ApiError';
    this.statusCode = body.statusCode;
    this.errorCode = body.error;
    this.correlationId = body.correlationId;
    this.details = body.details;
  }
}

export interface PaginatedResult<T> {
  data: T[];
  meta: { total: number; page: number; pageSize: number };
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Internal — set on the retry after a silent refresh, and on the auth endpoints themselves, to stop a 401 from ever triggering a second refresh attempt. */
  skipAuthRetry?: boolean;
}

/**
 * Concurrent 401s (e.g. a dashboard firing 6 queries at once against an
 * expired token) must all wait on the *same* refresh call, not each
 * fire their own — sharing this promise is what makes that atomic on
 * the client side.
 */
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function doRefresh(): Promise<string | null> {
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, { method: 'POST', credentials: 'include' });
    if (!res.ok) return null;
    const body = (await res.json()) as { accessToken: string };
    useAuthStore.getState().setAccessToken(body.accessToken);
    return body.accessToken;
  } catch {
    return null;
  }
}

/** Called once on app start to silently restore a session from the httpOnly refresh cookie, before anything renders behind a protected route. */
export function bootstrapSession(): Promise<string | null> {
  return refreshAccessToken();
}

/** Shared by apiFetch/downloadFile/uploadFile — the Authorization header + silent-refresh-on-401 retry, without assuming a JSON body. */
async function authorizedFetch(
  path: string,
  options: Omit<RequestInit, 'headers'> & { headers?: HeadersInit; skipAuthRetry?: boolean } = {},
): Promise<Response> {
  const { skipAuthRetry, headers, ...rest } = options;
  const token = useAuthStore.getState().accessToken;

  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    credentials: 'include',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  if (res.status === 401 && !skipAuthRetry) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return authorizedFetch(path, { ...options, skipAuthRetry: true });
    }
    useAuthStore.getState().clear();
  }

  return res;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, ...rest } = options;
  const res = await authorizedFetch(path, {
    ...rest,
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...rest.headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const contentType = res.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    throw new ApiError(payload as ApiErrorBody);
  }
  return payload as T;
}

/** Fetches a binary/protected response as a Blob — the access token lives in memory only (never a cookie), so a plain `<img src>`/`<a href>` can't authenticate; this is the shared building block for both downloadFile and an in-page <img> preview (see settings/pages/CompanyProfilePage.tsx). */
export async function fetchBlob(path: string): Promise<Blob> {
  const res = await authorizedFetch(path);
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(
      payload ?? { statusCode: res.status, error: 'Error', message: `Request failed (${res.status}).`, correlationId: '' },
    );
  }
  return res.blob();
}

/** Downloads a binary response (PDF export, etc.) and triggers a browser save — see apps/api's *-pdf.service.ts controllers. Filename is read from Content-Disposition when the server sets one, falling back to `fallbackFilename` otherwise. */
export async function downloadFile(path: string, fallbackFilename: string): Promise<void> {
  const res = await authorizedFetch(path);
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(
      payload ?? { statusCode: res.status, error: 'Error', message: `Download failed (${res.status}).`, correlationId: '' },
    );
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackFilename;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Multipart upload (e.g. the company logo) — must not set Content-Type itself so the browser can set the multipart boundary. */
export async function uploadFile<T>(path: string, file: File): Promise<T> {
  const form = new FormData();
  form.append('file', file);
  const res = await authorizedFetch(path, { method: 'POST', body: form });

  const contentType = res.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    throw new ApiError(payload as ApiErrorBody);
  }
  return payload as T;
}

/**
 * Accepts any plain object of query params (no index signature
 * required) — module-specific query DTOs like `QuerySuppliersDto`
 * don't declare one, and requiring it on every call-site interface
 * would be a needless constraint just to satisfy this helper.
 */
export function toQueryString<T extends object>(params: T): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => apiFetch<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: RequestOptions) => apiFetch<T>(path, { ...options, method: 'DELETE' }),
};
