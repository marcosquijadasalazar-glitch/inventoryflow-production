ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS pending_plan text
  CHECK (pending_plan IS NULL OR pending_plan IN ('starter','pro'));