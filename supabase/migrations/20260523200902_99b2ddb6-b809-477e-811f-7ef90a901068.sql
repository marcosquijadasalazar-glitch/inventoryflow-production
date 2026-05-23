-- Add enabled_modules per organization
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS enabled_modules jsonb NOT NULL DEFAULT '{
    "dashboard": true,
    "products": true,
    "movements": true,
    "scanner": true,
    "history": true,
    "purchase_orders": true,
    "sales_orders": true,
    "transfer_orders": true,
    "internal_use": true,
    "location_stock": true,
    "alerts": true,
    "reports": true,
    "exports": true,
    "settings": true,
    "users": true
  }'::jsonb;

-- Helper: check if a given module is enabled for the current user's org
CREATE OR REPLACE FUNCTION public.is_module_enabled(_module text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.is_super_admin() THEN true
    ELSE COALESCE(
      (SELECT (o.enabled_modules ->> _module)::boolean
       FROM public.organizations o
       WHERE o.id = public.current_user_org()),
      true
    )
  END
$$;