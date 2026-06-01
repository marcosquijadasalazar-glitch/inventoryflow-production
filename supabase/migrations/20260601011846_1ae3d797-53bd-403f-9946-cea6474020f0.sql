-- Phase 1: read-only unified view for stock by location.
-- Reproduces StockTab's current client-side derivation:
--   on_hand = products.stock attributed to bin_id (when set) or
--             the location node whose name matches products.location (case-insensitive),
--             plus +qty to to_location_id and -qty from from_location_id for COMPLETED transfers.
--   reserved = reuses product_reservations (pending_approval/approved transfers).
--   available = on_hand - reserved.
-- No writes, no triggers, no schema changes to existing tables.

CREATE OR REPLACE VIEW public.product_location_stock
WITH (security_invoker = true) AS
WITH base_assignments AS (
  SELECT
    p.organization_id,
    p.id AS product_id,
    COALESCE(
      p.bin_id,
      (
        SELECT l.id FROM public.locations l
        WHERE l.organization_id = p.organization_id
          AND p.location IS NOT NULL
          AND lower(btrim(l.name)) = lower(btrim(p.location))
          AND l.node_level = 'location'
        LIMIT 1
      )
    ) AS location_id,
    COALESCE(p.stock, 0) AS qty
  FROM public.products p
),
transfer_in AS (
  SELECT
    t.organization_id,
    toi.product_id,
    t.to_location_id AS location_id,
    SUM(toi.quantity)::int AS qty
  FROM public.transfer_order_items toi
  JOIN public.transfer_orders t ON t.id = toi.transfer_order_id
  WHERE t.status = 'completed'
    AND toi.product_id IS NOT NULL
    AND t.to_location_id IS NOT NULL
  GROUP BY t.organization_id, toi.product_id, t.to_location_id
),
transfer_out AS (
  SELECT
    t.organization_id,
    toi.product_id,
    t.from_location_id AS location_id,
    -SUM(toi.quantity)::int AS qty
  FROM public.transfer_order_items toi
  JOIN public.transfer_orders t ON t.id = toi.transfer_order_id
  WHERE t.status = 'completed'
    AND toi.product_id IS NOT NULL
    AND t.from_location_id IS NOT NULL
  GROUP BY t.organization_id, toi.product_id, t.from_location_id
),
combined AS (
  SELECT organization_id, product_id, location_id, qty
  FROM base_assignments
  WHERE location_id IS NOT NULL
  UNION ALL
  SELECT organization_id, product_id, location_id, qty FROM transfer_in
  UNION ALL
  SELECT organization_id, product_id, location_id, qty FROM transfer_out
),
agg AS (
  SELECT organization_id, product_id, location_id, SUM(qty)::int AS on_hand
  FROM combined
  GROUP BY organization_id, product_id, location_id
)
SELECT
  a.organization_id,
  a.product_id,
  p.name        AS product_name,
  p.sku         AS sku,
  a.location_id,
  l.name        AS location_name,
  a.on_hand,
  COALESCE(r.reserved_qty, 0)                 AS reserved,
  (a.on_hand - COALESCE(r.reserved_qty, 0))   AS available
FROM agg a
JOIN public.products p  ON p.id = a.product_id
LEFT JOIN public.locations l ON l.id = a.location_id
LEFT JOIN public.product_reservations r
  ON r.product_id = a.product_id
 AND r.from_location_id = a.location_id
 AND r.organization_id = a.organization_id;

GRANT SELECT ON public.product_location_stock TO authenticated;
GRANT SELECT ON public.product_location_stock TO service_role;