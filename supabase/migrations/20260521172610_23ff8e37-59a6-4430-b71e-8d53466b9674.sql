ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS amount_paid numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_due numeric NOT NULL DEFAULT 0;

UPDATE public.sales_orders
SET amount_paid = CASE WHEN payment_status = 'paid' THEN total ELSE 0 END,
    balance_due = CASE WHEN payment_status = 'paid' THEN 0 ELSE total END
WHERE amount_paid = 0 AND balance_due = 0;

CREATE TABLE public.sales_order_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  organization_id uuid,
  amount numeric NOT NULL CHECK (amount >= 0),
  payment_method text NOT NULL,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  previous_status text,
  new_status text,
  performed_by uuid,
  performed_by_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_order_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org read sales_order_payments"
  ON public.sales_order_payments FOR SELECT
  TO authenticated
  USING (is_super_admin() OR organization_id = current_user_org());

CREATE POLICY "owner manager insert sales_order_payments"
  ON public.sales_order_payments FOR INSERT
  TO authenticated
  WITH CHECK (
    is_super_admin() OR (
      (organization_id IS NULL OR organization_id = current_user_org())
      AND current_user_role() = ANY (ARRAY['owner'::app_role, 'manager'::app_role])
    )
  );

CREATE TRIGGER set_org_id_sales_order_payments
  BEFORE INSERT ON public.sales_order_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id();

CREATE INDEX sales_order_payments_so_id_idx
  ON public.sales_order_payments (sales_order_id, created_at DESC);