
-- Enum types
CREATE TYPE public.transaction_type AS ENUM (
  'product_created','product_updated','product_deleted',
  'stock_added','stock_removed','stock_adjusted','low_stock'
);
CREATE TYPE public.transaction_source AS ENUM ('manual','barcode_scan','adjustment','system');

-- Transaction history table
CREATE TABLE public.transaction_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  type public.transaction_type NOT NULL,
  source public.transaction_source NOT NULL DEFAULT 'manual',
  product_id uuid,
  product_name text,
  sku text,
  barcode text,
  quantity_change integer,
  previous_stock integer,
  new_stock integer,
  reason text,
  user_id uuid,
  user_email text
);
CREATE INDEX idx_history_created_at ON public.transaction_history (created_at DESC);
CREATE INDEX idx_history_product ON public.transaction_history (product_id);
CREATE INDEX idx_history_type ON public.transaction_history (type);

ALTER TABLE public.transaction_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read history" ON public.transaction_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated insert history" ON public.transaction_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated update history" ON public.transaction_history FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated delete history" ON public.transaction_history FOR DELETE TO authenticated USING (true);

-- Company settings
CREATE TABLE public.company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text,
  address text,
  phone text,
  email text,
  footer_notes text,
  logo_url text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read settings" ON public.company_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated insert settings" ON public.company_settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated update settings" ON public.company_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated delete settings" ON public.company_settings FOR DELETE TO authenticated USING (true);

-- Seed one settings row
INSERT INTO public.company_settings (company_name) VALUES ('InventoryFlow');

-- Trigger function: log movement to history & detect low-stock crossings
CREATE OR REPLACE FUNCTION public.log_movement_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  src := CASE WHEN NEW.note ILIKE '[scan]%' THEN 'barcode_scan'::public.transaction_source
              WHEN NEW.type = 'adjustment' THEN 'adjustment'::public.transaction_source
              ELSE 'manual'::public.transaction_source END;

  uid := auth.uid();
  SELECT email INTO uemail FROM auth.users WHERE id = uid;

  INSERT INTO public.transaction_history
    (type, source, product_id, product_name, sku, barcode, quantity_change, previous_stock, new_stock, reason, user_id, user_email)
  VALUES
    (txn_type, src, p.id, p.name, p.sku, p.barcode, NEW.quantity, prev_stock, new_stock, NEW.note, uid, uemail);

  -- Low stock event
  IF p.min_stock > 0 AND new_stock <= p.min_stock AND (prev_stock IS NULL OR prev_stock > p.min_stock) THEN
    INSERT INTO public.transaction_history
      (type, source, product_id, product_name, sku, barcode, new_stock, reason, user_id, user_email)
    VALUES
      ('low_stock', 'system', p.id, p.name, p.sku, p.barcode, new_stock,
       'Stock at or below minimum (' || p.min_stock || ')', uid, uemail);
  END IF;

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.log_movement_history() FROM PUBLIC, anon, authenticated;

-- Attach trigger AFTER apply_movement (which updates stock first)
DROP TRIGGER IF EXISTS trg_apply_movement ON public.inventory_movements;
DROP TRIGGER IF EXISTS trg_log_movement_history ON public.inventory_movements;
CREATE TRIGGER trg_apply_movement
  AFTER INSERT ON public.inventory_movements
  FOR EACH ROW EXECUTE FUNCTION public.apply_movement();
CREATE TRIGGER trg_log_movement_history
  AFTER INSERT ON public.inventory_movements
  FOR EACH ROW EXECUTE FUNCTION public.log_movement_history();

-- Storage bucket for branding
INSERT INTO storage.buckets (id, name, public) VALUES ('branding','branding',true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "branding public read" ON storage.objects FOR SELECT USING (bucket_id = 'branding');
CREATE POLICY "branding authenticated write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'branding');
CREATE POLICY "branding authenticated update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'branding');
CREATE POLICY "branding authenticated delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'branding');
