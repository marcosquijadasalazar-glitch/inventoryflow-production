ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS setup_fee_paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS setup_fee_paid_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS setup_fee_plan text;