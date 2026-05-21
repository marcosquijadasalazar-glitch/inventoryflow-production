
-- ============= ENUMS =============
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('super_admin', 'owner', 'manager', 'employee');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.org_plan AS ENUM ('free', 'starter', 'pro', 'enterprise');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============= ORGANIZATIONS =============
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  business_type text,
  logo_url text,
  active_status boolean NOT NULL DEFAULT true,
  plan_type public.org_plan NOT NULL DEFAULT 'free',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- ============= PROFILES =============
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  role public.app_role NOT NULL DEFAULT 'employee',
  full_name text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS profiles_org_idx ON public.profiles(organization_id);

-- ============= SECURITY DEFINER HELPERS =============
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_user_org()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'super_admin')
$$;

-- ============= AUTO-CREATE PROFILE ON SIGNUP =============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, role, organization_id)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'employee'),
    NULLIF(NEW.raw_user_meta_data->>'organization_id','')::uuid
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============= UPDATED_AT TRIGGER =============
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS organizations_updated_at ON public.organizations;
CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============= ATTACH organization_id TO EXISTING TABLES =============
ALTER TABLE public.products             ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.inventory_movements  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.transaction_history  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.company_settings     ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS products_org_idx    ON public.products(organization_id);
CREATE INDEX IF NOT EXISTS movements_org_idx   ON public.inventory_movements(organization_id);
CREATE INDEX IF NOT EXISTS history_org_idx     ON public.transaction_history(organization_id);
CREATE INDEX IF NOT EXISTS settings_org_idx    ON public.company_settings(organization_id);

-- ============= BACKFILL =============
DO $$
DECLARE
  default_org_id uuid;
  first_user_id uuid;
BEGIN
  SELECT id INTO default_org_id FROM public.organizations WHERE company_name = 'Default Organization' LIMIT 1;
  IF default_org_id IS NULL THEN
    INSERT INTO public.organizations (company_name, business_type, plan_type)
    VALUES ('Default Organization', 'Warehouse', 'pro')
    RETURNING id INTO default_org_id;
  END IF;

  -- Profiles for existing auth users → owners of default org
  INSERT INTO public.profiles (user_id, email, organization_id, role)
  SELECT u.id, u.email, default_org_id, 'owner'
  FROM auth.users u
  ON CONFLICT (user_id) DO UPDATE
    SET organization_id = COALESCE(public.profiles.organization_id, EXCLUDED.organization_id);

  -- Promote the oldest user to super_admin
  SELECT id INTO first_user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;
  IF first_user_id IS NOT NULL THEN
    UPDATE public.profiles SET role = 'super_admin' WHERE user_id = first_user_id;
  END IF;

  -- Backfill existing rows
  UPDATE public.products            SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.inventory_movements SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.transaction_history SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.company_settings    SET organization_id = default_org_id WHERE organization_id IS NULL;
END $$;

-- ============= AUTO-FILL organization_id ON INSERT =============
CREATE OR REPLACE FUNCTION public.set_organization_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := public.current_user_org();
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS set_org_products ON public.products;
CREATE TRIGGER set_org_products BEFORE INSERT ON public.products
FOR EACH ROW EXECUTE FUNCTION public.set_organization_id();

DROP TRIGGER IF EXISTS set_org_movements ON public.inventory_movements;
CREATE TRIGGER set_org_movements BEFORE INSERT ON public.inventory_movements
FOR EACH ROW EXECUTE FUNCTION public.set_organization_id();

DROP TRIGGER IF EXISTS set_org_history ON public.transaction_history;
CREATE TRIGGER set_org_history BEFORE INSERT ON public.transaction_history
FOR EACH ROW EXECUTE FUNCTION public.set_organization_id();

DROP TRIGGER IF EXISTS set_org_settings ON public.company_settings;
CREATE TRIGGER set_org_settings BEFORE INSERT ON public.company_settings
FOR EACH ROW EXECUTE FUNCTION public.set_organization_id();

-- The existing apply_movement trigger updates stock — keep it.
-- The existing log_movement_history trigger inserts into transaction_history;
-- the set_org_history BEFORE-INSERT trigger will fill organization_id automatically.

-- ============= RLS POLICIES =============

-- Organizations
DROP POLICY IF EXISTS "super_admin all orgs" ON public.organizations;
CREATE POLICY "super_admin all orgs" ON public.organizations FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "members read own org" ON public.organizations;
CREATE POLICY "members read own org" ON public.organizations FOR SELECT TO authenticated
  USING (id = public.current_user_org());

DROP POLICY IF EXISTS "owner update own org" ON public.organizations;
CREATE POLICY "owner update own org" ON public.organizations FOR UPDATE TO authenticated
  USING (id = public.current_user_org() AND public.current_user_role() IN ('owner','manager'))
  WITH CHECK (id = public.current_user_org());

-- Profiles
DROP POLICY IF EXISTS "super_admin all profiles" ON public.profiles;
CREATE POLICY "super_admin all profiles" ON public.profiles FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "self read profile" ON public.profiles;
CREATE POLICY "self read profile" ON public.profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "self update profile" ON public.profiles;
CREATE POLICY "self update profile" ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND role = public.current_user_role());

DROP POLICY IF EXISTS "org members read profiles" ON public.profiles;
CREATE POLICY "org members read profiles" ON public.profiles FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND organization_id = public.current_user_org());

DROP POLICY IF EXISTS "owner manage org profiles" ON public.profiles;
CREATE POLICY "owner manage org profiles" ON public.profiles FOR ALL TO authenticated
  USING (organization_id = public.current_user_org() AND public.current_user_role() IN ('owner','manager'))
  WITH CHECK (organization_id = public.current_user_org() AND public.current_user_role() IN ('owner','manager'));

-- Generic org-scoped policy set
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['products','inventory_movements','transaction_history','company_settings'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "authenticated read %1$s" ON public.%1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS "authenticated insert %1$s" ON public.%1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS "authenticated update %1$s" ON public.%1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS "authenticated delete %1$s" ON public.%1$s', t);

    EXECUTE format($p$
      CREATE POLICY "org or admin read %1$s" ON public.%1$s FOR SELECT TO authenticated
      USING (public.is_super_admin() OR organization_id = public.current_user_org())
    $p$, t);

    EXECUTE format($p$
      CREATE POLICY "org insert %1$s" ON public.%1$s FOR INSERT TO authenticated
      WITH CHECK (public.is_super_admin() OR organization_id IS NULL OR organization_id = public.current_user_org())
    $p$, t);

    EXECUTE format($p$
      CREATE POLICY "org update %1$s" ON public.%1$s FOR UPDATE TO authenticated
      USING (public.is_super_admin() OR organization_id = public.current_user_org())
      WITH CHECK (public.is_super_admin() OR organization_id = public.current_user_org())
    $p$, t);

    EXECUTE format($p$
      CREATE POLICY "org delete %1$s" ON public.%1$s FOR DELETE TO authenticated
      USING (public.is_super_admin() OR organization_id = public.current_user_org())
    $p$, t);
  END LOOP;
END $$;
