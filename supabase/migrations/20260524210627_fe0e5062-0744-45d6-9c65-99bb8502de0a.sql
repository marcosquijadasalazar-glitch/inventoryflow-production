DROP POLICY IF EXISTS "self update profile" ON public.profiles;

CREATE POLICY "self update profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND role = current_user_role()
  AND role <> 'super_admin'::app_role
  AND organization_id IS NOT DISTINCT FROM (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  )
  AND account_status IS NOT DISTINCT FROM (
    SELECT account_status FROM public.profiles WHERE user_id = auth.uid()
  )
);