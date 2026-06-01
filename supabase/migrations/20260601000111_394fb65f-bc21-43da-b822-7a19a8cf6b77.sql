
ALTER TABLE public.login_activity
  ADD COLUMN IF NOT EXISTS device_fingerprint text,
  ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_login_activity_ip_created
  ON public.login_activity (ip_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_activity_fingerprint
  ON public.login_activity (user_id, device_fingerprint);

ALTER TABLE public.user_presence
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS device_fingerprint text,
  ADD COLUMN IF NOT EXISTS os text,
  ADD COLUMN IF NOT EXISTS user_agent text;
