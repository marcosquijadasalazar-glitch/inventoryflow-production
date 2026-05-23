
-- Tighten profiles RLS: split the broad ALL policy so owners/managers can only
-- read/update/delete org profiles, not INSERT arbitrary rows with elevated roles.
-- New profile rows are created exclusively via the handle_new_user trigger
-- (SECURITY DEFINER) or via the service role in admin server functions.

DROP POLICY IF EXISTS "owner manage org profiles" ON public.profiles;

CREATE POLICY "owner read org profiles"
ON public.profiles
FOR SELECT
USING (
  organization_id = public.current_user_org()
  AND public.current_user_role() = ANY (ARRAY['owner'::public.app_role, 'manager'::public.app_role])
);

CREATE POLICY "owner update org profiles"
ON public.profiles
FOR UPDATE
USING (
  organization_id = public.current_user_org()
  AND public.current_user_role() = ANY (ARRAY['owner'::public.app_role, 'manager'::public.app_role])
)
WITH CHECK (
  organization_id = public.current_user_org()
  AND public.current_user_role() = ANY (ARRAY['owner'::public.app_role, 'manager'::public.app_role])
  AND role <> 'super_admin'::public.app_role
);

CREATE POLICY "owner delete org profiles"
ON public.profiles
FOR DELETE
USING (
  organization_id = public.current_user_org()
  AND public.current_user_role() = ANY (ARRAY['owner'::public.app_role, 'manager'::public.app_role])
);

-- Restrict self-insert to the user's own row only, and never with an elevated role.
-- Normal signups go through the handle_new_user SECURITY DEFINER trigger, but
-- this policy is a defense-in-depth backstop in case a client tries a direct insert.
CREATE POLICY "self insert own profile"
ON public.profiles
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND role = 'employee'::public.app_role
);
