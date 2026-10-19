-- Indexed expiry cleanup for the short-lived OAuth state table.
-- Additive only: existing sessions, answers and histories are unchanged.
CREATE INDEX IF NOT EXISTS oauth_pending_expiry ON oauth_pending(expires_at);
