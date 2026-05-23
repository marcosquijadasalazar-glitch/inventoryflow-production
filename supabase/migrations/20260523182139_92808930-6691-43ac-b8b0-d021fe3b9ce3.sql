
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS business_type text,
  ADD COLUMN IF NOT EXISTS phone text;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (
    user_id, email, full_name, role, organization_id, account_status,
    company_name, business_type, phone
  )
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'employee'),
    NULLIF(NEW.raw_user_meta_data->>'organization_id','')::uuid,
    'pending_approval',
    NULLIF(NEW.raw_user_meta_data->>'company_name',''),
    NULLIF(NEW.raw_user_meta_data->>'business_type',''),
    NULLIF(NEW.raw_user_meta_data->>'phone','')
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;
