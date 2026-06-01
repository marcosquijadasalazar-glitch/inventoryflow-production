-- Phase 2A: inventory_balances foundation table
CREATE TABLE public.inventory_balances (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  on_hand integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_balances_on_hand_nonneg CHECK (on_hand >= 0),
  CONSTRAINT inventory_balances_unique UNIQUE (organization_id, product_id, location_id)
);

CREATE INDEX idx_inventory_balances_product ON public.inventory_balances(product_id);
CREATE INDEX idx_inventory_balances_location ON public.inventory_balances(location_id);
CREATE INDEX idx_inventory_balances_org ON public.inventory_balances(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_balances TO authenticated;
GRANT ALL ON public.inventory_balances TO service_role;

ALTER TABLE public.inventory_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org read inventory_balances" ON public.inventory_balances
  FOR SELECT TO authenticated
  USING (is_super_admin() OR organization_id = current_user_org());

CREATE POLICY "org insert inventory_balances" ON public.inventory_balances
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin() OR organization_id = current_user_org());

CREATE POLICY "org update inventory_balances" ON public.inventory_balances
  FOR UPDATE TO authenticated
  USING (is_super_admin() OR organization_id = current_user_org())
  WITH CHECK (is_super_admin() OR organization_id = current_user_org());

CREATE POLICY "org delete inventory_balances" ON public.inventory_balances
  FOR DELETE TO authenticated
  USING (is_super_admin() OR organization_id = current_user_org());

CREATE TRIGGER inventory_balances_touch_updated_at
  BEFORE UPDATE ON public.inventory_balances
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Backfill: one row per product at its attributed location.
-- Precedence mirrors Phase 1 view: bin_id, else legacy location-text match, else oldest active org location.
INSERT INTO public.inventory_balances (organization_id, product_id, location_id, on_hand)
SELECT p.organization_id, p.id, loc_id, COALESCE(p.stock, 0)
FROM public.products p
CROSS JOIN LATERAL (
  SELECT COALESCE(
    -- 1. bin_id direct
    (SELECT l.id FROM public.locations l WHERE l.id = p.bin_id LIMIT 1),
    -- 2. legacy location text match
    (SELECT l.id FROM public.locations l
       WHERE l.organization_id = p.organization_id
         AND p.location IS NOT NULL
         AND lower(btrim(l.name)) = lower(btrim(p.location))
         AND l.node_level = 'location'
       LIMIT 1),
    -- 3. oldest active org location
    (SELECT l.id FROM public.locations l
       WHERE l.organization_id = p.organization_id
         AND l.is_active = true
         AND l.node_level = 'location'
       ORDER BY l.created_at ASC
       LIMIT 1)
  ) AS loc_id
) loc
WHERE p.organization_id IS NOT NULL AND loc_id IS NOT NULL
ON CONFLICT (organization_id, product_id, location_id) DO NOTHING;

-- Phase 2A: Update view to prefer inventory_balances when rows exist, else fall back to Phase 1 derivation.
CREATE OR REPLACE VIEW public.product_location_stock
WITH (security_invoker = true) AS
WITH ib AS (
  SELECT organization_id, product_id, location_id, on_hand
  FROM public.inventory_balances
),
products_with_ib AS (
  SELECT DISTINCT product_id FROM ib
),
base_assignments AS (
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
  WHERE p.id NOT IN (SELECT product_id FROM products_with_ib)
),
transfer_in AS (
  SELECT t.organization_id, toi.product_id, t.to_location_id AS location_id, SUM(toi.quantity)::int AS qty
  FROM public.transfer_order_items toi
  JOIN public.transfer_orders t ON t.id = toi.transfer_order_id
  WHERE t.status = 'completed'
    AND toi.product_id IS NOT NULL
    AND t.to_location_id IS NOT NULL
    AND toi.product_id NOT IN (SELECT product_id FROM products_with_ib)
  GROUP BY t.organization_id, toi.product_id, t.to_location_id
),
transfer_out AS (
  SELECT t.organization_id, toi.product_id, t.from_location_id AS location_id, -SUM(toi.quantity)::int AS qty
  FROM public.transfer_order_items toi
  JOIN public.transfer_orders t ON t.id = toi.transfer_order_id
  WHERE t.status = 'completed'
    AND toi.product_id IS NOT NULL
    AND t.from_location_id IS NOT NULL
    AND toi.product_id NOT IN (SELECT product_id FROM products_with_ib)
  GROUP BY t.organization_id, toi.product_id, t.from_location_id
),
fallback_combined AS (
  SELECT organization_id, product_id, location_id, qty FROM base_assignments WHERE location_id IS NOT NULL
  UNION ALL SELECT organization_id, product_id, location_id, qty FROM transfer_in
  UNION ALL SELECT organization_id, product_id, location_id, qty FROM transfer_out
),
fallback_agg AS (
  SELECT organization_id, product_id, location_id, SUM(qty)::int AS on_hand
  FROM fallback_combined
  GROUP BY organization_id, product_id, location_id
),
unified AS (
  SELECT organization_id, product_id, location_id, on_hand FROM ib
  UNION ALL
  SELECT organization_id, product_id, location_id, on_hand FROM fallback_agg
)
SELECT
  u.organization_id,
  u.product_id,
  p.name AS product_name,
  p.sku  AS sku,
  u.location_id,
  l.name AS location_name,
  u.on_hand,
  COALESCE(r.reserved_qty, 0)               AS reserved,
  (u.on_hand - COALESCE(r.reserved_qty, 0)) AS available
FROM unified u
JOIN public.products p ON p.id = u.product_id
LEFT JOIN public.locations l ON l.id = u.location_id
LEFT JOIN public.product_reservations r
  ON r.product_id = u.product_id
 AND r.from_location_id = u.location_id
 AND r.organization_id = u.organization_id;

GRANT SELECT ON public.product_location_stock TO authenticated;
GRANT SELECT ON public.product_location_stock TO service_role;