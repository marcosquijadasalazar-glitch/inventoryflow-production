
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS business_type text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS tax_id text,
  ADD COLUMN IF NOT EXISTS website text;

-- Ensure org_id always set on insert
DROP TRIGGER IF EXISTS set_org_settings ON public.company_settings;
CREATE TRIGGER set_org_settings BEFORE INSERT ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id();

-- Tighten UPDATE policy: owner or super_admin only
DROP POLICY IF EXISTS "org update company_settings" ON public.company_settings;
CREATE POLICY "owner update company_settings" ON public.company_settings
  FOR UPDATE TO authenticated
  USING (
    is_super_admin()
    OR (organization_id = current_user_org() AND current_user_role() = 'owner'::app_role)
  )
  WITH CHECK (
    is_super_admin()
    OR (organization_id = current_user_org() AND current_user_role() = 'owner'::app_role)
  );

-- Tighten INSERT policy: owner or super_admin only
DROP POLICY IF EXISTS "org insert company_settings" ON public.company_settings;
CREATE POLICY "owner insert company_settings" ON public.company_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    is_super_admin()
    OR (
      (organization_id IS NULL OR organization_id = current_user_org())
      AND current_user_role() = 'owner'::app_role
    )
  );
