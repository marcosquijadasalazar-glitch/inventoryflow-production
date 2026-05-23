
-- Locations table
CREATE TYPE public.location_type AS ENUM ('warehouse', 'store', 'shelf', 'bin', 'truck', 'other');

CREATE TABLE public.locations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid,
  name text NOT NULL,
  type public.location_type NOT NULL DEFAULT 'warehouse',
  address text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_locations_org ON public.locations(organization_id);
CREATE UNIQUE INDEX idx_locations_org_name ON public.locations(organization_id, lower(name));

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org read locations" ON public.locations
  FOR SELECT TO authenticated
  USING (is_super_admin() OR organization_id = current_user_org());

CREATE POLICY "org insert locations" ON public.locations
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin() OR organization_id IS NULL OR organization_id = current_user_org());

CREATE POLICY "org update locations" ON public.locations
  FOR UPDATE TO authenticated
  USING (is_super_admin() OR organization_id = current_user_org())
  WITH CHECK (is_super_admin() OR organization_id = current_user_org());

CREATE POLICY "org delete locations" ON public.locations
  FOR DELETE TO authenticated
  USING (is_super_admin() OR organization_id = current_user_org());

CREATE TRIGGER set_org_locations
  BEFORE INSERT ON public.locations
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id();

CREATE TRIGGER touch_locations
  BEFORE UPDATE ON public.locations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Link transfer_orders to locations (keep legacy text columns for back-compat / display fallback)
ALTER TABLE public.transfer_orders
  ADD COLUMN from_location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  ADD COLUMN to_location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL;
