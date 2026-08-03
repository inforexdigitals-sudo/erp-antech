/**
 * Claims embedded in the access token. Permission codes are resolved
 * once at login/refresh time (Role -> RolePermission -> Permission)
 * and embedded here so PermissionsGuard never needs a DB round trip
 * per request. Trade-off: a mid-session permission change only takes
 * effect on the user's next token refresh (max JWT_ACCESS_TTL later),
 * not instantly — acceptable for V1; a Redis-backed revocation list is
 * the documented upgrade path (docs/phase-3-system-architecture/api-architecture.md)
 * if that latency ever becomes a real problem.
 */
export interface JwtAccessPayload {
  sub: string; // user id
  companyId: string;
  permissions: string[]; // e.g. ['quotation.view', 'quotation.approve']
  type: 'access';
}

export interface TwoFactorChallengePayload {
  sub: string; // user id
  companyId: string;
  type: 'twofa_challenge';
}

/**
 * The refresh token itself is an opaque random string, not a JWT — see
 * modules/auth/auth.service.ts. The DB row (refresh_tokens, Phase 5
 * addendum) is the source of truth for its validity, expiry, and
 * rotation family, so a signed-but-otherwise-redundant JWT wrapper
 * would add complexity without adding security.
 */
export interface AuthenticatedUser {
  userId: string;
  companyId: string;
  permissions: string[];
}

/** Augments Express's Request with what JwtStrategy.validate() returns. */
declare module 'express' {
  interface Request {
    user?: AuthenticatedUser;
  }
}
