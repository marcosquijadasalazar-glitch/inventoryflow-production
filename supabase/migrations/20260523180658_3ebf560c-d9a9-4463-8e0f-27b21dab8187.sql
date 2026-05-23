-- account status enum
DO $$ BEGIN
  CREATE TYPE public.account_status AS ENUM ('pending_approval','trial_active','active','suspended','cancelled','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status public.account_status NOT NULL DEFAULT 'pending_approval',
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

-- Backfill existing rows as active
UPDATE public.profiles SET account_status = 'active' WHERE account_status = 'pending_approval' AND created_at < now() - interval '1 minute';

-- Update signup trigger to default new users to pending_approval
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, role, organization_id, account_status)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'employee'),
    NULLIF(NEW.raw_user_meta_data->>'organization_id','')::uuid,
    'pending_approval'
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $function$;