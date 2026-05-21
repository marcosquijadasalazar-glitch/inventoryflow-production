-- Products: drop public policies, add authenticated-only
DROP POLICY IF EXISTS "public read products" ON public.products;
DROP POLICY IF EXISTS "public write products" ON public.products;
DROP POLICY IF EXISTS "public update products" ON public.products;
DROP POLICY IF EXISTS "public delete products" ON public.products;

CREATE POLICY "authenticated read products"
  ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated insert products"
  ON public.products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated update products"
  ON public.products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated delete products"
  ON public.products FOR DELETE TO authenticated USING (true);

-- Inventory movements: drop public policies, add authenticated-only
DROP POLICY IF EXISTS "public read movements" ON public.inventory_movements;
DROP POLICY IF EXISTS "public insert movements" ON public.inventory_movements;

CREATE POLICY "authenticated read movements"
  ON public.inventory_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated insert movements"
  ON public.inventory_movements FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated update movements"
  ON public.inventory_movements FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated delete movements"
  ON public.inventory_movements FOR DELETE TO authenticated USING (true);