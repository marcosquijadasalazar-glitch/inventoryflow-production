
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_step integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS demo_data_installed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_dismissed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_business_size text,
  ADD COLUMN IF NOT EXISTS onboarding_product_volume text,
  ADD COLUMN IF NOT EXISTS onboarding_location_count text,
  ADD COLUMN IF NOT EXISTS onboarding_started_at timestamptz;

-- Backfill existing orgs as completed so the wizard does not pop up for them
UPDATE public.organizations
   SET onboarding_completed = true,
       onboarding_completed_at = COALESCE(onboarding_completed_at, now()),
       onboarding_step = 4
 WHERE onboarding_completed = false
   AND created_at < now() - interval '1 minute';
