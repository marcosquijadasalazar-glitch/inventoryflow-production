
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS parent_id uuid NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS node_level text NOT NULL DEFAULT 'location',
  ADD COLUMN IF NOT EXISTS code text NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'locations_node_level_check'
  ) THEN
    ALTER TABLE public.locations
      ADD CONSTRAINT locations_node_level_check
      CHECK (node_level IN ('location','sublocation','aisle','bin'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_locations_org_parent
  ON public.locations(organization_id, parent_id);

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS bin_id uuid NULL REFERENCES public.locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_bin ON public.products(bin_id);
