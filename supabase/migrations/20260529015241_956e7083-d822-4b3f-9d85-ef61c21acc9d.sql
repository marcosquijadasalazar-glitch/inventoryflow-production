-- 1) Revoke direct read access to sensitive billing/lifecycle columns from tenant users.
REVOKE SELECT (
  stripe_customer_id,
  stripe_subscription_id,
  stripe_price_id,
  setup_fee_paid,
  setup_fee_paid_at,
  setup_fee_plan,
  pending_plan,
  grace_period_ends_at,
  current_period_end,
  has_used_trial,
  deletion_reason,
  deleted_by,
  deleted_at
) ON public.organizations FROM authenticated, anon;

-- 2) Revoke ALL update privileges from authenticated, then re-grant only safe columns.
REVOKE UPDATE ON public.organizations FROM authenticated, anon;

GRANT UPDATE (
  company_name,
  business_type,
  logo_url,
  onboarding_completed,
  onboarding_step,
  onboarding_completed_at,
  onboarding_dismissed,
  onboarding_business_size,
  onboarding_product_volume,
  onboarding_location_count,
  onboarding_started_at,
  demo_data_installed
) ON public.organizations TO authenticated;

-- Ensure service_role retains full access for server-side functions.
GRANT ALL ON public.organizations TO service_role;

-- 3) Tighten the UPDATE RLS policy to owner only (was owner+manager).
DROP POLICY IF EXISTS "owner update own org" ON public.organizations;

CREATE POLICY "owner update own org"
ON public.organizations
FOR UPDATE
TO authenticated
USING (id = current_user_org() AND current_user_role() = 'owner'::app_role)
WITH CHECK (id = current_user_org() AND current_user_role() = 'owner'::app_role);