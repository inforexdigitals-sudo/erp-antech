/**
 * Decodes the access token's claims for UI purposes only (which nav
 * items to show, etc.) — not a security boundary. The server is the
 * only thing that actually enforces permissions; a user editing this
 * client-side never gains access to anything the API wouldn't already
 * allow them.
 */
export interface AccessTokenClaims {
  sub: string;
  companyId: string;
  permissions: string[];
  exp: number;
}

export function decodeAccessToken(token: string): AccessTokenClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '=');
    const json = atob(padded);
    return JSON.parse(json) as AccessTokenClaims;
  } catch {
    return null;
  }
}
