
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS deletion_reason text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS deletion_reason text;

CREATE OR REPLACE FUNCTION public.current_user_org()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.organization_id
  FROM public.profiles p
  LEFT JOIN public.organizations o ON o.id = p.organization_id
  WHERE p.user_id = auth.uid()
    AND p.is_active = true
    AND p.suspended_at IS NULL
    AND p.archived_at IS NULL
    AND p.deleted_at IS NULL
    AND (
      p.account_status = 'active'
      OR (p.account_status = 'trial_active' AND (p.trial_ends_at IS NULL OR p.trial_ends_at > now()))
    )
    AND (
      p.organization_id IS NULL
      OR (
        o.is_active = true
        AND o.active_status = true
        AND o.suspended_at IS NULL
        AND o.archived_at IS NULL
        AND o.deleted_at IS NULL
      )
    )
$function$;
