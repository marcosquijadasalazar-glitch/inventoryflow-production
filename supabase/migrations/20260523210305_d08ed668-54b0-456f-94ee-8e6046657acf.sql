
-- Plan limits helper
CREATE OR REPLACE FUNCTION public.plan_limits(_plan public.org_plan)
RETURNS TABLE(max_users int, max_products int, max_locations int)
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT
    CASE _plan
      WHEN 'free'       THEN 2
      WHEN 'starter'    THEN 3
      WHEN 'pro'        THEN 25
      WHEN 'enterprise' THEN NULL
    END,
    CASE _plan
      WHEN 'free'       THEN 100
      WHEN 'starter'    THEN 500
      WHEN 'pro'        THEN NULL
      WHEN 'enterprise' THEN NULL
    END,
    CASE _plan
      WHEN 'free'       THEN 1
      WHEN 'starter'    THEN 2
      WHEN 'pro'        THEN 10
      WHEN 'enterprise' THEN NULL
    END
$$;

-- Enforcement trigger function
CREATE OR REPLACE FUNCTION public.enforce_plan_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_id uuid;
  plan public.org_plan;
  lim int;
  used int;
  kind text := TG_ARGV[0];
BEGIN
  -- Super admins bypass all plan limits
  IF public.is_super_admin() THEN
    RETURN NEW;
  END IF;

  org_id := NEW.organization_id;
  IF org_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT plan_type INTO plan FROM public.organizations WHERE id = org_id;
  IF plan IS NULL THEN RETURN NEW; END IF;

  IF kind = 'users' THEN
    SELECT max_users INTO lim FROM public.plan_limits(plan);
    IF lim IS NULL THEN RETURN NEW; END IF;
    SELECT count(*) INTO used FROM public.profiles
      WHERE organization_id = org_id
        AND deleted_at IS NULL AND archived_at IS NULL AND is_active = true;
    IF used >= lim THEN
      RAISE EXCEPTION 'PLAN_LIMIT_USERS:%:%', used, lim USING ERRCODE = 'check_violation';
    END IF;
  ELSIF kind = 'products' THEN
    SELECT max_products INTO lim FROM public.plan_limits(plan);
    IF lim IS NULL THEN RETURN NEW; END IF;
    SELECT count(*) INTO used FROM public.products WHERE organization_id = org_id;
    IF used >= lim THEN
      RAISE EXCEPTION 'PLAN_LIMIT_PRODUCTS:%:%', used, lim USING ERRCODE = 'check_violation';
    END IF;
  ELSIF kind = 'locations' THEN
    SELECT max_locations INTO lim FROM public.plan_limits(plan);
    IF lim IS NULL THEN RETURN NEW; END IF;
    SELECT count(*) INTO used FROM public.locations
      WHERE organization_id = org_id AND is_active = true;
    IF used >= lim THEN
      RAISE EXCEPTION 'PLAN_LIMIT_LOCATIONS:%:%', used, lim USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_plan_limit_products ON public.products;
CREATE TRIGGER enforce_plan_limit_products
  BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_limit('products');

DROP TRIGGER IF EXISTS enforce_plan_limit_locations ON public.locations;
CREATE TRIGGER enforce_plan_limit_locations
  BEFORE INSERT ON public.locations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_limit('locations');

DROP TRIGGER IF EXISTS enforce_plan_limit_profiles ON public.profiles;
CREATE TRIGGER enforce_plan_limit_profiles
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_limit('users');

-- Usage snapshot helper (RLS-aware via is_super_admin/current_user_org)
CREATE OR REPLACE FUNCTION public.org_plan_usage(_org_id uuid)
RETURNS TABLE(
  plan public.org_plan,
  max_users int, max_products int, max_locations int,
  used_users int, used_products int, used_locations int
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.plan_type,
    l.max_users, l.max_products, l.max_locations,
    (SELECT count(*)::int FROM public.profiles p
       WHERE p.organization_id = o.id
         AND p.deleted_at IS NULL AND p.archived_at IS NULL AND p.is_active = true),
    (SELECT count(*)::int FROM public.products pr WHERE pr.organization_id = o.id),
    (SELECT count(*)::int FROM public.locations lo
       WHERE lo.organization_id = o.id AND lo.is_active = true)
  FROM public.organizations o
  LEFT JOIN LATERAL public.plan_limits(o.plan_type) l ON true
  WHERE o.id = _org_id
$$;
