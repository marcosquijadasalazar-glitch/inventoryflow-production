
-- Make Starter (and legacy free) show all modules; growth is gated by capacity, not feature locks.
CREATE OR REPLACE FUNCTION public.plan_modules(_plan org_plan)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE _plan
    WHEN 'free' THEN jsonb_build_object(
      'dashboard', true, 'products', true, 'movements', true, 'scanner', true,
      'alerts', true, 'settings', true, 'users', true,
      'history', true, 'purchase_orders', true, 'sales_orders', true,
      'exports', true,
      'transfer_orders', true, 'internal_use', true, 'location_stock', true,
      'reports', true
    )
    WHEN 'starter' THEN jsonb_build_object(
      'dashboard', true, 'products', true, 'movements', true, 'scanner', true,
      'alerts', true, 'settings', true, 'users', true,
      'history', true, 'purchase_orders', true, 'sales_orders', true,
      'exports', true,
      'transfer_orders', true, 'internal_use', true, 'location_stock', true,
      'reports', true
    )
    WHEN 'pro' THEN jsonb_build_object(
      'dashboard', true, 'products', true, 'movements', true, 'scanner', true,
      'alerts', true, 'settings', true, 'users', true,
      'history', true, 'purchase_orders', true, 'sales_orders', true,
      'exports', true,
      'transfer_orders', true, 'internal_use', true, 'location_stock', true,
      'reports', true
    )
    WHEN 'enterprise' THEN jsonb_build_object(
      'dashboard', true, 'products', true, 'movements', true, 'scanner', true,
      'alerts', true, 'settings', true, 'users', true,
      'history', true, 'purchase_orders', true, 'sales_orders', true,
      'exports', true,
      'transfer_orders', true, 'internal_use', true, 'location_stock', true,
      'reports', true
    )
  END
$function$;

-- Re-sync modules for any org that hasn't opted into manual overrides.
UPDATE public.organizations
   SET enabled_modules = public.plan_modules(plan_type)
 WHERE COALESCE(module_overrides_enabled, false) = false;

-- Trialing flag (cached from Stripe webhook).
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS is_trialing boolean NOT NULL DEFAULT false;

UPDATE public.organizations
   SET is_trialing = (subscription_status = 'trialing')
 WHERE is_trialing IS DISTINCT FROM (subscription_status = 'trialing');

-- Signup-checkout staging table: lets the webhook hand back a one-time
-- temporary password to the browser that started the checkout. Service-role
-- access only; never exposed to anon/authenticated.
CREATE TABLE IF NOT EXISTS public.signup_sessions (
  session_id text PRIMARY KEY,
  email text NOT NULL,
  plan text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  user_id uuid,
  organization_id uuid,
  temp_password text,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.signup_sessions TO service_role;
ALTER TABLE public.signup_sessions ENABLE ROW LEVEL SECURITY;
-- No policies for anon/authenticated: table is only touched by service_role
-- (Stripe webhook + checkout server fn + signup-status server fn).
