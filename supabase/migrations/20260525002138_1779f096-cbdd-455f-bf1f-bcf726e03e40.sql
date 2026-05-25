
-- 1. Tighten INSERT policies to require organization_id = current_user_org()
-- (super_admin still bypasses via is_super_admin()).

DO $$
DECLARE
  r record;
  tbl text;
  policy_name text;
  tables text[] := ARRAY[
    'products',
    'inventory_movements',
    'transaction_history',
    'company_settings',
    'suppliers',
    'customers',
    'locations',
    'purchase_orders',
    'transfer_orders',
    'sales_orders',
    'product_categories'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    FOR r IN
      SELECT polname
      FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = tbl
        AND p.polcmd = 'a' -- INSERT
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', r.polname, tbl);
    END LOOP;
  END LOOP;
END $$;

CREATE POLICY "org insert products" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin() OR organization_id = current_user_org());

CREATE POLICY "org insert inventory_movements" ON public.inventory_movements
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin() OR organization_id = current_user_org());

CREATE POLICY "org insert transaction_history" ON public.transaction_history
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin() OR organization_id = current_user_org());

CREATE POLICY "org insert company_settings" ON public.company_settings
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin() OR organization_id = current_user_org());

CREATE POLICY "org insert suppliers" ON public.suppliers
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin() OR organization_id = current_user_org());

CREATE POLICY "org insert customers" ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin() OR organization_id = current_user_org());

CREATE POLICY "org insert locations" ON public.locations
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin() OR organization_id = current_user_org());

CREATE POLICY "org insert product_categories" ON public.product_categories
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin() OR organization_id = current_user_org());

-- purchase_orders, transfer_orders, sales_orders use FOR ALL "org write *" policies in addition.
-- Recreate scoped INSERT-only policy (FOR ALL policies on those tables remain and already
-- require organization_id = current_user_org() in USING; we add WITH CHECK tightening).
CREATE POLICY "org insert purchase_orders" ON public.purchase_orders
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin() OR organization_id = current_user_org());

CREATE POLICY "org insert transfer_orders" ON public.transfer_orders
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin() OR organization_id = current_user_org());

CREATE POLICY "org insert sales_orders" ON public.sales_orders
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin() OR organization_id = current_user_org());

-- Also tighten the FOR ALL write policies' WITH CHECK on po/so/transfer so they don't leak NULL inserts.
DROP POLICY IF EXISTS "org write po" ON public.purchase_orders;
CREATE POLICY "org write po" ON public.purchase_orders
  FOR ALL TO authenticated
  USING (is_super_admin() OR organization_id = current_user_org())
  WITH CHECK (is_super_admin() OR organization_id = current_user_org());

DROP POLICY IF EXISTS "org write so" ON public.sales_orders;
CREATE POLICY "org write so" ON public.sales_orders
  FOR ALL TO authenticated
  USING (is_super_admin() OR organization_id = current_user_org())
  WITH CHECK (is_super_admin() OR organization_id = current_user_org());

DROP POLICY IF EXISTS "org write transfer" ON public.transfer_orders;
CREATE POLICY "org write transfer" ON public.transfer_orders
  FOR ALL TO authenticated
  USING (is_super_admin() OR organization_id = current_user_org())
  WITH CHECK (is_super_admin() OR organization_id = current_user_org());

-- 2. Add DELETE policy for product_categories (org-scoped).
CREATE POLICY "org delete product_categories" ON public.product_categories
  FOR DELETE TO authenticated
  USING (is_super_admin() OR organization_id = current_user_org());

-- 3. Add UPDATE/DELETE policies for sales_order_payments (owner/manager only).
CREATE POLICY "owner manager update sales_order_payments" ON public.sales_order_payments
  FOR UPDATE TO authenticated
  USING (
    is_super_admin() OR (
      organization_id = current_user_org()
      AND current_user_role() = ANY (ARRAY['owner'::app_role, 'manager'::app_role])
    )
  )
  WITH CHECK (
    is_super_admin() OR (
      organization_id = current_user_org()
      AND current_user_role() = ANY (ARRAY['owner'::app_role, 'manager'::app_role])
    )
  );

CREATE POLICY "owner manager delete sales_order_payments" ON public.sales_order_payments
  FOR DELETE TO authenticated
  USING (
    is_super_admin() OR (
      organization_id = current_user_org()
      AND current_user_role() = ANY (ARRAY['owner'::app_role, 'manager'::app_role])
    )
  );
