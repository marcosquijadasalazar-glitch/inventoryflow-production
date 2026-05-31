
ALTER TABLE public.login_activity
  ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'auth';

UPDATE public.login_activity
SET severity = CASE
    WHEN status = 'failed' THEN 'warning'
    ELSE 'info'
  END,
  category = CASE
    WHEN action LIKE 'checkout%' THEN 'billing'
    WHEN action IN ('invite_accepted','password_reset_requested','password_changed') THEN 'access'
    ELSE 'auth'
  END
WHERE severity = 'info' AND category = 'auth';

CREATE INDEX IF NOT EXISTS idx_login_activity_severity ON public.login_activity(severity);
CREATE INDEX IF NOT EXISTS idx_login_activity_category ON public.login_activity(category);
CREATE INDEX IF NOT EXISTS idx_login_activity_created ON public.login_activity(created_at DESC);

CREATE OR REPLACE FUNCTION public.prevent_login_activity_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'login_activity is append-only; % is not allowed', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS login_activity_no_update ON public.login_activity;
DROP TRIGGER IF EXISTS login_activity_no_delete ON public.login_activity;

CREATE TRIGGER login_activity_no_update
BEFORE UPDATE ON public.login_activity
FOR EACH ROW EXECUTE FUNCTION public.prevent_login_activity_mutation();

CREATE TRIGGER login_activity_no_delete
BEFORE DELETE ON public.login_activity
FOR EACH ROW EXECUTE FUNCTION public.prevent_login_activity_mutation();
