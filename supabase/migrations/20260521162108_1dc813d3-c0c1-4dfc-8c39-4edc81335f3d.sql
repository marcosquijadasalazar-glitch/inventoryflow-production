
-- =========================================
-- Extend transaction source enum
-- =========================================
ALTER TYPE public.transaction_source ADD VALUE IF NOT EXISTS 'internal_use';

-- =========================================
-- Status enums
-- =========================================
DO $$ BEGIN
  CREATE TYPE public.po_status AS ENUM ('draft','ordered','partially_received','received','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.so_status AS ENUM ('draft','confirmed','fulfilled','cancelled','refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('unpaid','paid','partial','refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.transfer_status AS ENUM ('draft','in_transit','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================
-- Suppliers
-- =========================================
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  name text NOT NULL,
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER suppliers_set_org BEFORE INSERT ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id();
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org read suppliers" ON public.suppliers FOR SELECT TO authenticated
  USING (is_super_admin() OR organization_id = current_user_org());
CREATE POLICY "org insert suppliers" ON public.suppliers FOR INSERT TO authenticated
  WITH CHECK (is_super_admin() OR organization_id IS NULL OR organization_id = current_user_org());
CREATE POLICY "org update suppliers" ON public.suppliers FOR UPDATE TO authenticated
  USING (is_super_admin() OR organization_id = current_user_org())
  WITH CHECK (is_super_admin() OR organization_id = current_user_org());
CREATE POLICY "org delete suppliers" ON public.suppliers FOR DELETE TO authenticated
  USING (is_super_admin() OR organization_id = current_user_org());

-- =========================================
-- Customers
-- =========================================
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  name text NOT NULL,
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER customers_set_org BEFORE INSERT ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id();
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org read customers" ON public.customers FOR SELECT TO authenticated
  USING (is_super_admin() OR organization_id = current_user_org());
CREATE POLICY "org insert customers" ON public.customers FOR INSERT TO authenticated
  WITH CHECK (is_super_admin() OR organization_id IS NULL OR organization_id = current_user_org());
CREATE POLICY "org update customers" ON public.customers FOR UPDATE TO authenticated
  USING (is_super_admin() OR organization_id = current_user_org())
  WITH CHECK (is_super_admin() OR organization_id = current_user_org());
CREATE POLICY "org delete customers" ON public.customers FOR DELETE TO authenticated
  USING (is_super_admin() OR organization_id = current_user_org());

-- =========================================
-- Purchase Orders
-- =========================================
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text NOT NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  organization_id uuid,
  status public.po_status NOT NULL DEFAULT 'draft',
  order_date date,
  expected_date date,
  received_date date,
  notes text,
  subtotal numeric NOT NULL DEFAULT 0,
  tax numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER purchase_orders_set_org BEFORE INSERT ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id();

CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id uuid,
  sku text,
  barcode text,
  product_name text,
  quantity_ordered integer NOT NULL DEFAULT 0,
  quantity_received integer NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0
);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org read po" ON public.purchase_orders FOR SELECT TO authenticated
  USING (is_super_admin() OR organization_id = current_user_org());
CREATE POLICY "org write po" ON public.purchase_orders FOR ALL TO authenticated
  USING (is_super_admin() OR organization_id = current_user_org())
  WITH CHECK (is_super_admin() OR organization_id IS NULL OR organization_id = current_user_org());

CREATE POLICY "org read po items" ON public.purchase_order_items FOR SELECT TO authenticated
  USING (is_super_admin() OR EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_id AND po.organization_id = current_user_org()
  ));
CREATE POLICY "org write po items" ON public.purchase_order_items FOR ALL TO authenticated
  USING (is_super_admin() OR EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_id AND po.organization_id = current_user_org()
  ))
  WITH CHECK (is_super_admin() OR EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_id AND po.organization_id = current_user_org()
  ));

-- =========================================
-- Sales Orders
-- =========================================
CREATE TABLE IF NOT EXISTS public.sales_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  so_number text NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  organization_id uuid,
  status public.so_status NOT NULL DEFAULT 'draft',
  order_date date,
  fulfilled_date date,
  notes text,
  subtotal numeric NOT NULL DEFAULT 0,
  tax numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  payment_method text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER sales_orders_set_org BEFORE INSERT ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id();

CREATE TABLE IF NOT EXISTS public.sales_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  product_id uuid,
  sku text,
  barcode text,
  product_name text,
  quantity integer NOT NULL DEFAULT 0,
  unit_price numeric NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  margin numeric NOT NULL DEFAULT 0
);

ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org read so" ON public.sales_orders FOR SELECT TO authenticated
  USING (is_super_admin() OR organization_id = current_user_org());
CREATE POLICY "org write so" ON public.sales_orders FOR ALL TO authenticated
  USING (is_super_admin() OR organization_id = current_user_org())
  WITH CHECK (is_super_admin() OR organization_id IS NULL OR organization_id = current_user_org());

CREATE POLICY "org read so items" ON public.sales_order_items FOR SELECT TO authenticated
  USING (is_super_admin() OR EXISTS (
    SELECT 1 FROM public.sales_orders so
    WHERE so.id = sales_order_id AND so.organization_id = current_user_org()
  ));
CREATE POLICY "org write so items" ON public.sales_order_items FOR ALL TO authenticated
  USING (is_super_admin() OR EXISTS (
    SELECT 1 FROM public.sales_orders so
    WHERE so.id = sales_order_id AND so.organization_id = current_user_org()
  ))
  WITH CHECK (is_super_admin() OR EXISTS (
    SELECT 1 FROM public.sales_orders so
    WHERE so.id = sales_order_id AND so.organization_id = current_user_org()
  ));

-- =========================================
-- Transfer Orders
-- =========================================
CREATE TABLE IF NOT EXISTS public.transfer_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_number text NOT NULL,
  organization_id uuid,
  from_location text,
  to_location text,
  status public.transfer_status NOT NULL DEFAULT 'draft',
  transfer_date date,
  completed_date date,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER transfer_orders_set_org BEFORE INSERT ON public.transfer_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id();

CREATE TABLE IF NOT EXISTS public.transfer_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_order_id uuid NOT NULL REFERENCES public.transfer_orders(id) ON DELETE CASCADE,
  product_id uuid,
  sku text,
  barcode text,
  product_name text,
  quantity integer NOT NULL DEFAULT 0
);

ALTER TABLE public.transfer_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org read transfer" ON public.transfer_orders FOR SELECT TO authenticated
  USING (is_super_admin() OR organization_id = current_user_org());
CREATE POLICY "org write transfer" ON public.transfer_orders FOR ALL TO authenticated
  USING (is_super_admin() OR organization_id = current_user_org())
  WITH CHECK (is_super_admin() OR organization_id IS NULL OR organization_id = current_user_org());

CREATE POLICY "org read transfer items" ON public.transfer_order_items FOR SELECT TO authenticated
  USING (is_super_admin() OR EXISTS (
    SELECT 1 FROM public.transfer_orders t
    WHERE t.id = transfer_order_id AND t.organization_id = current_user_org()
  ));
CREATE POLICY "org write transfer items" ON public.transfer_order_items FOR ALL TO authenticated
  USING (is_super_admin() OR EXISTS (
    SELECT 1 FROM public.transfer_orders t
    WHERE t.id = transfer_order_id AND t.organization_id = current_user_org()
  ))
  WITH CHECK (is_super_admin() OR EXISTS (
    SELECT 1 FROM public.transfer_orders t
    WHERE t.id = transfer_order_id AND t.organization_id = current_user_org()
  ));

-- =========================================
-- Update movement history trigger to detect internal_use
-- =========================================
CREATE OR REPLACE FUNCTION public.log_movement_history()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  prev_stock int;
  new_stock int;
  p record;
  txn_type public.transaction_type;
  src public.transaction_source;
  uid uuid;
  uemail text;
BEGIN
  SELECT id, name, sku, barcode, stock, min_stock INTO p FROM public.products WHERE id = NEW.product_id;
  IF p.id IS NULL THEN RETURN NEW; END IF;

  new_stock := p.stock;
  IF NEW.type = 'add' THEN
    prev_stock := new_stock - NEW.quantity;
    txn_type := 'stock_added';
  ELSIF NEW.type = 'remove' THEN
    prev_stock := new_stock + NEW.quantity;
    txn_type := 'stock_removed';
  ELSE
    prev_stock := NULL;
    txn_type := 'stock_adjusted';
  END IF;

  src := CASE
    WHEN NEW.note ILIKE '[internal_use]%' THEN 'internal_use'::public.transaction_source
    WHEN NEW.note ILIKE '[scan]%' THEN 'barcode_scan'::public.transaction_source
    WHEN NEW.type = 'adjustment' THEN 'adjustment'::public.transaction_source
    ELSE 'manual'::public.transaction_source
  END;

  uid := auth.uid();
  SELECT email INTO uemail FROM auth.users WHERE id = uid;

  INSERT INTO public.transaction_history
    (type, source, product_id, product_name, sku, barcode, quantity_change, previous_stock, new_stock, reason, user_id, user_email)
  VALUES
    (txn_type, src, p.id, p.name, p.sku, p.barcode, NEW.quantity, prev_stock, new_stock, NEW.note, uid, uemail);

  IF p.min_stock > 0 AND new_stock <= p.min_stock AND (prev_stock IS NULL OR prev_stock > p.min_stock) THEN
    INSERT INTO public.transaction_history
      (type, source, product_id, product_name, sku, barcode, new_stock, reason, user_id, user_email)
    VALUES
      ('low_stock', 'system', p.id, p.name, p.sku, p.barcode, new_stock,
       'Stock at or below minimum (' || p.min_stock || ')', uid, uemail);
  END IF;

  RETURN NEW;
END;
$function$;

CREATE INDEX IF NOT EXISTS idx_po_items_po ON public.purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_so_items_so ON public.sales_order_items(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_transfer_items_t ON public.transfer_order_items(transfer_order_id);
CREATE INDEX IF NOT EXISTS idx_po_org ON public.purchase_orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_so_org ON public.sales_orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_transfer_org ON public.transfer_orders(organization_id);
