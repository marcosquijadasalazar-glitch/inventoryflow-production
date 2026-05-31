-- Revoke UPDATE on protected billing/lifecycle/module columns from authenticated.
-- Only service_role (used by server functions and Stripe webhook) can write these.
REVOKE UPDATE (
  plan_type,
  stripe_customer_id,
  stripe_subscription_id,
  stripe_price_id,
  subscription_status,
  is_trialing,
  has_used_trial,
  grace_period_ends_at,
  current_period_end,
  setup_fee_paid,
  setup_fee_paid_at,
  setup_fee_plan,
  pending_plan,
  enabled_modules,
  module_overrides_enabled,
  suspended_at,
  archived_at,
  deleted_at,
  deleted_by,
  deletion_reason,
  is_active,
  active_status
) ON public.organizations FROM authenticated;

-- Ensure service_role retains full access (no-op if already granted).
GRANT ALL ON public.organizations TO service_role;