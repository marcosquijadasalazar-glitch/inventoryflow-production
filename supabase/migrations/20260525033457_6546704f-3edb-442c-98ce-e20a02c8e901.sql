
-- 1. Column for opt-in custom module overrides
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS module_overrides_enabled boolean NOT NULL DEFAULT false;

-- 2. Canonical plan -> modules preset
CREATE OR REPLACE FUNCTION public.plan_modules(_plan public.org_plan)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _plan
    WHEN 'free' THEN jsonb_build_object(
      'dashboard', true, 'products', true, 'movements', true, 'scanner', true,
      'alerts', true, 'settings', true, 'users', true,
      'history', false, 'purchase_orders', false, 'sales_orders', false,
      'transfer_orders', false, 'internal_use', false, 'location_stock', false,
      'reports', false, 'exports', false
    )
    WHEN 'starter' THEN jsonb_build_object(
      'dashboard', true, 'products', true, 'movements', true, 'scanner', true,
      'alerts', true, 'settings', true, 'users', true,
      'history', true, 'purchase_orders', true, 'sales_orders', true,
      'exports', true,
      'transfer_orders', false, 'internal_use', false, 'location_stock', false,
      'reports', false
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
$$;

-- 3. Trigger: sync modules from plan unless overrides enabled
CREATE OR REPLACE FUNCTION public.sync_org_modules_from_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- On insert, always apply preset unless caller explicitly opted into overrides.
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.module_overrides_enabled, false) = false THEN
      NEW.enabled_modules := public.plan_modules(NEW.plan_type);
    END IF;
    RETURN NEW;
  END IF;

  -- On update, re-sync when plan changes (and overrides not enabled),
  -- or when overrides were just disabled.
  IF COALESCE(NEW.module_overrides_enabled, false) = false THEN
    IF NEW.plan_type IS DISTINCT FROM OLD.plan_type
       OR COALESCE(OLD.module_overrides_enabled, false) = true THEN
      NEW.enabled_modules := public.plan_modules(NEW.plan_type);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organizations_sync_modules ON public.organizations;
CREATE TRIGGER organizations_sync_modules
  BEFORE INSERT OR UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.sync_org_modules_from_plan();

-- 4. Backfill existing orgs that don't have overrides
UPDATE public.organizations
SET enabled_modules = public.plan_modules(plan_type)
WHERE COALESCE(module_overrides_enabled, false) = false;
