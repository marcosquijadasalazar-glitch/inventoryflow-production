
DROP POLICY IF EXISTS "authenticated delete products"   ON public.products;
DROP POLICY IF EXISTS "authenticated insert products"   ON public.products;
DROP POLICY IF EXISTS "authenticated read products"     ON public.products;
DROP POLICY IF EXISTS "authenticated update products"   ON public.products;

DROP POLICY IF EXISTS "authenticated delete movements"  ON public.inventory_movements;
DROP POLICY IF EXISTS "authenticated insert movements"  ON public.inventory_movements;
DROP POLICY IF EXISTS "authenticated read movements"    ON public.inventory_movements;
DROP POLICY IF EXISTS "authenticated update movements"  ON public.inventory_movements;

DROP POLICY IF EXISTS "authenticated delete history"    ON public.transaction_history;
DROP POLICY IF EXISTS "authenticated insert history"    ON public.transaction_history;
DROP POLICY IF EXISTS "authenticated read history"      ON public.transaction_history;
DROP POLICY IF EXISTS "authenticated update history"    ON public.transaction_history;

DROP POLICY IF EXISTS "authenticated delete settings"   ON public.company_settings;
DROP POLICY IF EXISTS "authenticated insert settings"   ON public.company_settings;
DROP POLICY IF EXISTS "authenticated read settings"     ON public.company_settings;
DROP POLICY IF EXISTS "authenticated update settings"   ON public.company_settings;
