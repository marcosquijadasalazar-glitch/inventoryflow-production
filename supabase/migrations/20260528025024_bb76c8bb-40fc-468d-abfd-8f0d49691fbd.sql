
-- Login Activity audit table
CREATE TABLE public.login_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  organization_id uuid,
  email text,
  action text NOT NULL,
  status text NOT NULL DEFAULT 'info',
  ip_address text,
  user_agent text,
  browser text,
  device text,
  os text,
  country text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_login_activity_org_created ON public.login_activity(organization_id, created_at DESC);
CREATE INDEX idx_login_activity_user_created ON public.login_activity(user_id, created_at DESC);
CREATE INDEX idx_login_activity_action ON public.login_activity(action);

GRANT SELECT ON public.login_activity TO authenticated;
GRANT ALL ON public.login_activity TO service_role;

ALTER TABLE public.login_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org viewers read login_activity"
  ON public.login_activity FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR (
      organization_id IS NOT NULL
      AND organization_id = public.current_user_org()
      AND public.current_user_role() IN ('owner','manager')
    )
    OR user_id = auth.uid()
  );

-- User Presence table
CREATE TABLE public.user_presence (
  user_id uuid PRIMARY KEY,
  organization_id uuid,
  is_online boolean NOT NULL DEFAULT false,
  current_page text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  browser text,
  device text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_presence_org ON public.user_presence(organization_id, last_seen_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.user_presence TO authenticated;
GRANT ALL ON public.user_presence TO service_role;

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org viewers read user_presence"
  ON public.user_presence FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR (
      organization_id IS NOT NULL
      AND organization_id = public.current_user_org()
      AND public.current_user_role() IN ('owner','manager')
    )
    OR user_id = auth.uid()
  );

CREATE POLICY "self upsert user_presence"
  ON public.user_presence FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "self update user_presence"
  ON public.user_presence FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_user_presence_touch
  BEFORE UPDATE ON public.user_presence
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
