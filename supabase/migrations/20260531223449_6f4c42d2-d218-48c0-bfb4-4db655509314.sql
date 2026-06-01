
ALTER TABLE public.transfer_orders
  ADD COLUMN IF NOT EXISTS approval_request_id uuid,
  ADD COLUMN IF NOT EXISTS requested_by uuid,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

CREATE INDEX IF NOT EXISTS idx_transfer_orders_org_status
  ON public.transfer_orders (organization_id, status);

CREATE OR REPLACE VIEW public.product_reservations
WITH (security_invoker = true) AS
SELECT
  toi.product_id,
  t.organization_id,
  t.from_location_id,
  SUM(toi.quantity)::int AS reserved_qty
FROM public.transfer_order_items toi
JOIN public.transfer_orders t ON t.id = toi.transfer_order_id
WHERE t.status IN ('pending_approval','approved')
  AND toi.product_id IS NOT NULL
GROUP BY toi.product_id, t.organization_id, t.from_location_id;

GRANT SELECT ON public.product_reservations TO authenticated;
GRANT SELECT ON public.product_reservations TO service_role;
