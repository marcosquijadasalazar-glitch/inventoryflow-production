-- Scope per-user permission overrides to the user's current organization.
-- Previously a stale row in user_permissions for an old organization could
-- still grant/deny a permission after a super admin reassigned the user.
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _perm app_permission)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role public.app_role;
  v_org uuid;
  v_override boolean;
  v_role_override boolean;
BEGIN
  SELECT role, organization_id INTO v_role, v_org
  FROM public.profiles WHERE user_id = _user_id;

  IF v_role IS NULL THEN RETURN false; END IF;
  IF v_role = 'super_admin' THEN RETURN true; END IF;
  IF v_role = 'owner' THEN RETURN true; END IF;

  -- per-user override (scoped to current org only)
  IF v_org IS NOT NULL THEN
    SELECT granted INTO v_override
    FROM public.user_permissions
    WHERE user_id = _user_id
      AND permission = _perm
      AND organization_id = v_org;
    IF FOUND THEN RETURN v_override; END IF;
  END IF;

  -- per-org role override
  IF v_org IS NOT NULL THEN
    SELECT granted INTO v_role_override
    FROM public.role_permissions
    WHERE organization_id = v_org AND role = v_role AND permission = _perm;
    IF FOUND THEN RETURN v_role_override; END IF;
  END IF;

  -- hardcoded defaults
  IF v_role = 'manager' THEN
    RETURN _perm IN (
      'view_dashboard','view_products','create_products','edit_products','delete_products',
      'view_costs','view_prices','view_movements','create_movements','adjust_stock',
      'view_transaction_history','export_data','view_reports',
      'manage_purchase_orders','manage_sales_orders','record_payments',
      'manage_transfer_orders','manage_internal_use','use_barcode_scanner',
      'manage_alerts','manage_locations'
    );
  ELSIF v_role = 'employee' THEN
    RETURN _perm IN (
      'view_dashboard','view_products','view_movements','create_movements',
      'use_barcode_scanner','manage_internal_use'
    );
  END IF;

  RETURN false;
END;
$function$;

-- Backfill: remove orphan user_permissions rows whose organization_id does
-- not match the user's current organization. These rows are leftover access
-- grants from previous organizations and must not affect current access.
DELETE FROM public.user_permissions up
WHERE NOT EXISTS (
  SELECT 1
  FROM public.profiles p
  WHERE p.user_id = up.user_id
    AND p.organization_id = up.organization_id
);