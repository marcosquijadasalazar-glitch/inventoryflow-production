
-- 1) Harden can_manage_permissions: require active, non-suspended, non-archived account
CREATE OR REPLACE FUNCTION public.can_manage_permissions(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      LEFT JOIN public.organizations o ON o.id = p.organization_id
      WHERE p.user_id = auth.uid()
        AND p.organization_id = _org_id
        AND p.role IN ('owner','manager')
        AND p.is_active = true
        AND p.suspended_at IS NULL
        AND p.archived_at IS NULL
        AND p.deleted_at IS NULL
        AND (
          p.account_status = 'active'
          OR (p.account_status = 'trial_active' AND (p.trial_ends_at IS NULL OR p.trial_ends_at > now()))
        )
        AND (
          o.id IS NULL
          OR (
            o.is_active = true
            AND o.active_status = true
            AND o.suspended_at IS NULL
            AND o.archived_at IS NULL
            AND o.deleted_at IS NULL
          )
        )
    );
$function$;

-- 2) Prevent owner/manager from promoting anyone above their own role.
-- Managers can only edit employees/managers (not owners or super_admin).
-- Owners can edit any role except super_admin (existing rule).
DROP POLICY IF EXISTS "owner update org profiles" ON public.profiles;

CREATE POLICY "owner update org profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  organization_id = current_user_org()
  AND current_user_role() = ANY (ARRAY['owner'::app_role, 'manager'::app_role])
  AND (
    current_user_role() = 'owner'::app_role
    OR role IN ('employee'::app_role, 'manager'::app_role)
  )
)
WITH CHECK (
  organization_id = current_user_org()
  AND current_user_role() = ANY (ARRAY['owner'::app_role, 'manager'::app_role])
  AND role <> 'super_admin'::app_role
  AND (
    current_user_role() = 'owner'::app_role
    OR role IN ('employee'::app_role, 'manager'::app_role)
  )
);
