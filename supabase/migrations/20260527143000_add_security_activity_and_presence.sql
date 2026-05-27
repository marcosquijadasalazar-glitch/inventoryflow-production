-- Security observability: login/security audit + realtime-ish presence.

CREATE TABLE IF NOT EXISTS public.login_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id uuid NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NULL,
  action text NOT NULL,
  status text NOT NULL,
  ip_address text NULL,
  user_agent text NULL,
  browser text NULL,
  device text NULL,
  os text NULL,
  country text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_activity_org_created
  ON public.login_activity (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_activity_user_created
  ON public.login_activity (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_activity_action_created
  ON public.login_activity (action, created_at DESC);

ALTER TABLE public.login_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_manager_view_login_activity" ON public.login_activity;
CREATE POLICY "owner_manager_view_login_activity"
  ON public.login_activity
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND (
          p.role = 'super_admin'
          OR (
            p.organization_id = login_activity.organization_id
            AND p.role IN ('owner', 'manager')
          )
        )
    )
  );

CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  is_online boolean NOT NULL DEFAULT true,
  current_page text NULL,
  device text NULL,
  browser text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_presence_org_seen
  ON public.user_presence (organization_id, last_seen_at DESC);

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_manager_view_presence" ON public.user_presence;
CREATE POLICY "owner_manager_view_presence"
  ON public.user_presence
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND (
          p.role = 'super_admin'
          OR (
            p.organization_id = user_presence.organization_id
            AND p.role IN ('owner', 'manager')
          )
        )
    )
  );

DROP POLICY IF EXISTS "user_manage_own_presence" ON public.user_presence;
CREATE POLICY "user_manage_own_presence"
  ON public.user_presence
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS trg_user_presence_updated_at ON public.user_presence;
CREATE TRIGGER trg_user_presence_updated_at
  BEFORE UPDATE ON public.user_presence
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

REVOKE ALL ON public.login_activity FROM anon, authenticated;
REVOKE ALL ON public.user_presence FROM anon, authenticated;

GRANT SELECT ON public.login_activity TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_presence TO authenticated;

GRANT ALL ON public.login_activity TO service_role;
GRANT ALL ON public.user_presence TO service_role;
