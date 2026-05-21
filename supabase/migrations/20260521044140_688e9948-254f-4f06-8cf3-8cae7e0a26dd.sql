
-- Profiles status fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Organizations status fields
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'active';

-- Backfill: organizations.active_status -> is_active for consistency
UPDATE public.organizations SET is_active = active_status WHERE is_active <> active_status;

-- Admin audit log
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  target_label text,
  performed_by uuid,
  performed_by_email text,
  previous_status text,
  new_status text,
  reason text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin audit log all" ON public.admin_audit_log;
CREATE POLICY "super_admin audit log all" ON public.admin_audit_log
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target ON public.admin_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created ON public.admin_audit_log(created_at DESC);

-- Tighten current_user_org() so inactive/suspended/archived users
-- (or users in inactive/suspended/archived orgs) cannot access org data.
CREATE OR REPLACE FUNCTION public.current_user_org()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.organization_id
  FROM public.profiles p
  LEFT JOIN public.organizations o ON o.id = p.organization_id
  WHERE p.user_id = auth.uid()
    AND p.is_active = true
    AND p.suspended_at IS NULL
    AND p.archived_at IS NULL
    AND (
      p.organization_id IS NULL
      OR (
        o.is_active = true
        AND o.active_status = true
        AND o.suspended_at IS NULL
        AND o.archived_at IS NULL
      )
    )
$$;
