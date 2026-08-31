import { api } from '../../lib/api-client';

export type LoginResult = { status: 'requires_2fa'; challengeToken: string } | { status: 'success'; accessToken: string };

export function login(email: string, password: string): Promise<LoginResult> {
  return api.post<LoginResult>('/auth/login', { email, password }, { skipAuthRetry: true });
}

export function verify2fa(challengeToken: string, code: string): Promise<{ accessToken: string }> {
  return api.post<{ accessToken: string }>('/auth/2fa/verify', { challengeToken, code }, { skipAuthRetry: true });
}

export function logout(): Promise<void> {
  return api.post<void>('/auth/logout', undefined, { skipAuthRetry: true });
}

export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return api.post<void>('/auth/change-password', { currentPassword, newPassword });
}
