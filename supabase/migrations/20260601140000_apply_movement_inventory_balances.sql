-- Phase 2B: location-aware apply_movement keeps inventory_balances in sync.
-- Transfer completion and movement forms set location_id / from_location_id / to_location_id;
-- this trigger applies deltas per location and syncs products.stock to SUM(balances).

ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS from_location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS to_location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.apply_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_loc_id uuid;
BEGIN
  v_org_id := NEW.organization_id;
  IF v_org_id IS NULL THEN
    SELECT organization_id INTO v_org_id FROM public.products WHERE id = NEW.product_id;
  END IF;

  IF NEW.type = 'remove' THEN
    v_loc_id := COALESCE(NEW.from_location_id, NEW.location_id);
    IF v_loc_id IS NOT NULL AND v_org_id IS NOT NULL THEN
      INSERT INTO public.inventory_balances (organization_id, product_id, location_id, on_hand)
      VALUES (v_org_id, NEW.product_id, v_loc_id, 0)
      ON CONFLICT (organization_id, product_id, location_id) DO NOTHING;

      UPDATE public.inventory_balances
      SET on_hand = GREATEST(on_hand - NEW.quantity, 0), updated_at = now()
      WHERE organization_id = v_org_id
        AND product_id = NEW.product_id
        AND location_id = v_loc_id;

      UPDATE public.products
      SET stock = (
        SELECT COALESCE(SUM(on_hand), 0)
        FROM public.inventory_balances
        WHERE product_id = NEW.product_id
          AND organization_id = v_org_id
      ),
      updated_at = now()
      WHERE id = NEW.product_id;
    ELSE
      UPDATE public.products
      SET stock = GREATEST(stock - NEW.quantity, 0), updated_at = now()
      WHERE id = NEW.product_id;
    END IF;

  ELSIF NEW.type = 'add' THEN
    v_loc_id := COALESCE(NEW.to_location_id, NEW.location_id);
    IF v_loc_id IS NOT NULL AND v_org_id IS NOT NULL THEN
      INSERT INTO public.inventory_balances (organization_id, product_id, location_id, on_hand)
      VALUES (v_org_id, NEW.product_id, v_loc_id, NEW.quantity)
      ON CONFLICT (organization_id, product_id, location_id)
      DO UPDATE SET
        on_hand = inventory_balances.on_hand + EXCLUDED.on_hand,
        updated_at = now();

      UPDATE public.products
      SET stock = (
        SELECT COALESCE(SUM(on_hand), 0)
        FROM public.inventory_balances
        WHERE product_id = NEW.product_id
          AND organization_id = v_org_id
      ),
      updated_at = now()
      WHERE id = NEW.product_id;
    ELSE
      UPDATE public.products
      SET stock = stock + NEW.quantity, updated_at = now()
      WHERE id = NEW.product_id;
    END IF;

  ELSIF NEW.type = 'adjustment' THEN
    v_loc_id := COALESCE(NEW.location_id, NEW.to_location_id, NEW.from_location_id);
    IF v_loc_id IS NOT NULL AND v_org_id IS NOT NULL THEN
      INSERT INTO public.inventory_balances (organization_id, product_id, location_id, on_hand)
      VALUES (v_org_id, NEW.product_id, v_loc_id, NEW.quantity)
      ON CONFLICT (organization_id, product_id, location_id)
      DO UPDATE SET on_hand = EXCLUDED.on_hand, updated_at = now();

      UPDATE public.products
      SET stock = (
        SELECT COALESCE(SUM(on_hand), 0)
        FROM public.inventory_balances
        WHERE product_id = NEW.product_id
          AND organization_id = v_org_id
      ),
      updated_at = now()
      WHERE id = NEW.product_id;
    ELSE
      UPDATE public.products
      SET stock = NEW.quantity, updated_at = now()
      WHERE id = NEW.product_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_movement() FROM PUBLIC, anon, authenticated;
