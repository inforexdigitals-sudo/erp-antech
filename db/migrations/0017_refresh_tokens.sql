-- =====================================================================
-- 0017_refresh_tokens.sql
-- Addendum to Phase 2, added during Phase 5 (Auth module) implementation.
--
-- Phase 2 didn't include this because refresh-token rotation with
-- reuse detection — the standard mitigation for a stolen refresh token
-- being replayed after the legitimate client has already rotated past
-- it — requires server-side state that a purely stateless JWT doesn't
-- have. That requirement only became concrete while implementing
-- auth.service.ts, not during the original schema design pass.
--
-- token_hash stores SHA-256 of the actual refresh token, never the
-- token itself — a leaked row doesn't hand out a usable credential.
-- token_family groups one chain of rotations; if a token is presented
-- that isn't the current tip of its family (i.e. it was already
-- rotated away), the whole family is revoked — see AuthService.refresh().
-- =====================================================================

CREATE TABLE refresh_tokens (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_family   UUID NOT NULL,
  token_hash     TEXT NOT NULL,
  replaced_by_id UUID REFERENCES refresh_tokens(id) ON DELETE SET NULL,
  revoked_at     TIMESTAMPTZ,
  expires_at     TIMESTAMPTZ NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (token_hash)
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_family ON refresh_tokens(token_family);
