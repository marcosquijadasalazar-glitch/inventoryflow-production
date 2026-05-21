-- Track inventory deduction independently from status so confirmed/fulfilled
-- both deduct exactly once, and cancellation can reverse correctly.
ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS inventory_deducted_at timestamptz,
  ADD COLUMN IF NOT EXISTS inventory_reversed_at timestamptz;