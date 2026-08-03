-- =====================================================================
-- 0014_notifications.sql — Module 17: Notifications
-- =====================================================================

CREATE TABLE notifications (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  recipient_user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  recipient_portal_account_id UUID REFERENCES portal_accounts(id) ON DELETE CASCADE,
  type                    TEXT NOT NULL,   -- e.g. 'approval_pending','po_delivered','claim_due'
  title                   TEXT NOT NULL,
  body                    TEXT,
  related_entity_type     TEXT,
  related_entity_id       UUID,
  is_read                 BOOLEAN NOT NULL DEFAULT FALSE,
  read_at                 TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (recipient_user_id IS NOT NULL OR recipient_portal_account_id IS NOT NULL)
);
CREATE INDEX idx_notifications_recipient_unread ON notifications(recipient_user_id) WHERE NOT is_read;
CREATE INDEX idx_notifications_company_created ON notifications(company_id, created_at DESC);

CREATE TABLE notification_preferences (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  channel    TEXT NOT NULL CHECK (channel IN ('in_app','email','sms','whatsapp','push')),
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (user_id, event_type, channel)
);

CREATE TABLE push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL,
  p256dh_key  TEXT NOT NULL,
  auth_key    TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);
