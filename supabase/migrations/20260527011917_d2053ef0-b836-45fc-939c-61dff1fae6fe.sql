
-- 1) signup_sessions: explicit super_admin-only policies (server uses service_role and bypasses RLS)
DROP POLICY IF EXISTS "super_admin all signup_sessions" ON public.signup_sessions;
CREATE POLICY "super_admin all signup_sessions"
  ON public.signup_sessions
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

REVOKE ALL ON public.signup_sessions FROM anon, authenticated;
GRANT SELECT ON public.signup_sessions TO authenticated; -- only super_admin will pass RLS
GRANT ALL ON public.signup_sessions TO service_role;

-- 2) organizations: prevent owners/managers from updating billing/lifecycle columns via column-level grants.
--    RLS still applies; the column grants further restrict which columns can be written by authenticated users.
REVOKE UPDATE ON public.organizations FROM authenticated;

-- Safe, owner/manager-editable columns only
GRANT UPDATE (
  company_name,
  business_type,
  logo_url,
  onboarding_business_size,
  onboarding_product_volume,
  onboarding_location_count,
  onboarding_started_at,
  onboarding_completed,
  onboarding_step,
  onboarding_completed_at,
  onboarding_dismissed,
  demo_data_installed,
  updated_at
) ON public.organizations TO authenticated;

-- service_role keeps full access for server-side billing/admin flows
GRANT ALL ON public.organizations TO service_role;

-- Tighten the existing policy's WITH CHECK to require owner role (matches USING) so managers cannot
-- escalate via UPDATE; column grants above also block them from billing fields.
DROP POLICY IF EXISTS "owner update own org" ON public.organizations;
CREATE POLICY "owner update own org"
  ON public.organizations
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (
    id = public.current_user_org()
    AND public.current_user_role() = ANY (ARRAY['owner'::public.app_role, 'manager'::public.app_role])
  )
  WITH CHECK (
    id = public.current_user_org()
    AND public.current_user_role() = ANY (ARRAY['owner'::public.app_role, 'manager'::public.app_role])
  );
