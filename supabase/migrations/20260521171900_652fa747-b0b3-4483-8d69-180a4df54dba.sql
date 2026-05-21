CREATE TABLE public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX product_categories_org_name_active_idx
  ON public.product_categories (organization_id, lower(name))
  WHERE is_active = true;

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org read product_categories"
  ON public.product_categories FOR SELECT
  TO authenticated
  USING (is_super_admin() OR organization_id = current_user_org());

CREATE POLICY "org insert product_categories"
  ON public.product_categories FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin() OR organization_id IS NULL OR organization_id = current_user_org());

CREATE POLICY "org update product_categories"
  ON public.product_categories FOR UPDATE
  TO authenticated
  USING (is_super_admin() OR organization_id = current_user_org())
  WITH CHECK (is_super_admin() OR organization_id = current_user_org());

CREATE TRIGGER set_org_id_product_categories
  BEFORE INSERT ON public.product_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id();

CREATE TRIGGER touch_product_categories
  BEFORE UPDATE ON public.product_categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();