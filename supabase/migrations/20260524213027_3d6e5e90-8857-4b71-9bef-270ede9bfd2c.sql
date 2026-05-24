
-- ============ Enum ============
DO $$ BEGIN
  CREATE TYPE public.app_permission AS ENUM (
    'view_dashboard',
    'view_products',
    'create_products',
    'edit_products',
    'delete_products',
    'view_costs',
    'view_prices',
    'view_movements',
    'create_movements',
    'adjust_stock',
    'view_transaction_history',
    'export_data',
    'view_reports',
    'manage_purchase_orders',
    'manage_sales_orders',
    'record_payments',
    'manage_transfer_orders',
    'manage_internal_use',
    'use_barcode_scanner',
    'manage_alerts',
    'manage_locations',
    'manage_users',
    'manage_company_settings'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ Tables ============
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  role public.app_role NOT NULL,
  permission public.app_permission NOT NULL,
  granted boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, role, permission)
);

CREATE TABLE IF NOT EXISTS public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  permission public.app_permission NOT NULL,
  granted boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission)
);

CREATE INDEX IF NOT EXISTS role_permissions_org_role_idx
  ON public.role_permissions(organization_id, role);
CREATE INDEX IF NOT EXISTS user_permissions_user_idx
  ON public.user_permissions(user_id);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- ============ has_permission ============
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _perm public.app_permission)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
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

  -- per-user override
  SELECT granted INTO v_override
  FROM public.user_permissions
  WHERE user_id = _user_id AND permission = _perm;
  IF FOUND THEN RETURN v_override; END IF;

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
$$;

-- ============ Helper guard for owner/manager-of-org ============
CREATE OR REPLACE FUNCTION public.can_manage_permissions(_org_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
        AND organization_id = _org_id
        AND role IN ('owner','manager')
    );
$$;

-- ============ RLS: role_permissions ============
DROP POLICY IF EXISTS "org read role_permissions" ON public.role_permissions;
CREATE POLICY "org read role_permissions" ON public.role_permissions
  FOR SELECT TO authenticated
  USING (is_super_admin() OR organization_id = current_user_org());

DROP POLICY IF EXISTS "owner write role_permissions" ON public.role_permissions;
CREATE POLICY "owner write role_permissions" ON public.role_permissions
  FOR ALL TO authenticated
  USING (
    is_super_admin()
    OR (can_manage_permissions(organization_id) AND role <> 'super_admin')
  )
  WITH CHECK (
    is_super_admin()
    OR (can_manage_permissions(organization_id) AND role <> 'super_admin')
  );

-- ============ RLS: user_permissions ============
DROP POLICY IF EXISTS "self or org read user_permissions" ON public.user_permissions;
CREATE POLICY "self or org read user_permissions" ON public.user_permissions
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR user_id = auth.uid()
    OR organization_id = current_user_org()
  );

DROP POLICY IF EXISTS "owner write user_permissions" ON public.user_permissions;
CREATE POLICY "owner write user_permissions" ON public.user_permissions
  FOR ALL TO authenticated
  USING (
    is_super_admin()
    OR (
      can_manage_permissions(organization_id)
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = user_permissions.user_id
          AND p.organization_id = user_permissions.organization_id
          AND p.role <> 'super_admin'
      )
    )
  )
  WITH CHECK (
    is_super_admin()
    OR (
      can_manage_permissions(organization_id)
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = user_permissions.user_id
          AND p.organization_id = user_permissions.organization_id
          AND p.role <> 'super_admin'
      )
    )
  );

-- ============ Audit trigger ============
CREATE OR REPLACE FUNCTION public.audit_permission_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  uemail text;
  ttype text;
  tid uuid;
  meta jsonb;
BEGIN
  uid := auth.uid();
  SELECT email INTO uemail FROM auth.users WHERE id = uid;

  IF TG_TABLE_NAME = 'role_permissions' THEN
    ttype := 'role_permission';
    tid := COALESCE(NEW.organization_id, OLD.organization_id);
    meta := jsonb_build_object(
      'op', TG_OP,
      'role', COALESCE(NEW.role::text, OLD.role::text),
      'permission', COALESCE(NEW.permission::text, OLD.permission::text),
      'old_granted', CASE WHEN TG_OP <> 'INSERT' THEN OLD.granted END,
      'new_granted', CASE WHEN TG_OP <> 'DELETE' THEN NEW.granted END,
      'organization_id', COALESCE(NEW.organization_id, OLD.organization_id)
    );
  ELSE
    ttype := 'user_permission';
    tid := COALESCE(NEW.user_id, OLD.user_id);
    meta := jsonb_build_object(
      'op', TG_OP,
      'permission', COALESCE(NEW.permission::text, OLD.permission::text),
      'old_granted', CASE WHEN TG_OP <> 'INSERT' THEN OLD.granted END,
      'new_granted', CASE WHEN TG_OP <> 'DELETE' THEN NEW.granted END,
      'organization_id', COALESCE(NEW.organization_id, OLD.organization_id),
      'user_id', COALESCE(NEW.user_id, OLD.user_id)
    );
  END IF;

  INSERT INTO public.admin_audit_log
    (action_type, target_type, target_id, performed_by, performed_by_email, metadata)
  VALUES
    ('permission_change', ttype, tid, uid, uemail, meta);

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS audit_role_permissions ON public.role_permissions;
CREATE TRIGGER audit_role_permissions
  AFTER INSERT OR UPDATE OR DELETE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.audit_permission_change();

DROP TRIGGER IF EXISTS audit_user_permissions ON public.user_permissions;
CREATE TRIGGER audit_user_permissions
  AFTER INSERT OR UPDATE OR DELETE ON public.user_permissions
  FOR EACH ROW EXECUTE FUNCTION public.audit_permission_change();

-- Touch updated_at
DROP TRIGGER IF EXISTS touch_role_permissions ON public.role_permissions;
CREATE TRIGGER touch_role_permissions BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS touch_user_permissions ON public.user_permissions;
CREATE TRIGGER touch_user_permissions BEFORE UPDATE ON public.user_permissions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
