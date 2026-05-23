
-- 1) PRIVILEGE_ESCALATION: prevent owners/managers from setting role='super_admin'
DROP POLICY IF EXISTS "owner manage org profiles" ON public.profiles;

CREATE POLICY "owner manage org profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (
  (organization_id = public.current_user_org())
  AND (public.current_user_role() = ANY (ARRAY['owner'::public.app_role, 'manager'::public.app_role]))
)
WITH CHECK (
  (organization_id = public.current_user_org())
  AND (public.current_user_role() = ANY (ARRAY['owner'::public.app_role, 'manager'::public.app_role]))
  AND (role <> 'super_admin'::public.app_role)
);

-- Also harden self update so a user cannot self-promote to super_admin
DROP POLICY IF EXISTS "self update profile" ON public.profiles;
CREATE POLICY "self update profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND role = public.current_user_role()
  AND role <> 'super_admin'::public.app_role
);

-- 2) Fix mutable search_path on touch_updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$;

-- 3) Revoke EXECUTE from public/anon on SECURITY DEFINER + trigger functions.
-- Trigger functions: not callable from PostgREST; revoke everywhere.
REVOKE ALL ON FUNCTION public.apply_movement() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_organization_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_movement_history() FROM PUBLIC, anon, authenticated;

-- Helper functions used in RLS: revoke from anon/public, keep authenticated
REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

REVOKE ALL ON FUNCTION public.current_user_org() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_org() TO authenticated;

-- 4) Branding storage bucket: scope writes by org folder, restrict listing
DROP POLICY IF EXISTS "branding public read" ON storage.objects;
DROP POLICY IF EXISTS "branding read" ON storage.objects;
DROP POLICY IF EXISTS "branding select" ON storage.objects;
DROP POLICY IF EXISTS "branding insert" ON storage.objects;
DROP POLICY IF EXISTS "branding update" ON storage.objects;
DROP POLICY IF EXISTS "branding delete" ON storage.objects;
DROP POLICY IF EXISTS "branding authenticated write" ON storage.objects;
DROP POLICY IF EXISTS "branding auth insert" ON storage.objects;
DROP POLICY IF EXISTS "branding auth update" ON storage.objects;
DROP POLICY IF EXISTS "branding auth delete" ON storage.objects;
DROP POLICY IF EXISTS "Public read branding" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload branding" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update branding" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete branding" ON storage.objects;

-- Public can read individual files only (no broad listing exposure beyond
-- direct object access — bucket is intentionally public for served logos).
CREATE POLICY "branding read individual objects"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'branding');

-- Writes scoped to the acting user's organization folder
CREATE POLICY "branding org-scoped insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'branding'
  AND (storage.foldername(name))[1] = public.current_user_org()::text
);

CREATE POLICY "branding org-scoped update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'branding'
  AND (storage.foldername(name))[1] = public.current_user_org()::text
)
WITH CHECK (
  bucket_id = 'branding'
  AND (storage.foldername(name))[1] = public.current_user_org()::text
);

CREATE POLICY "branding org-scoped delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'branding'
  AND (storage.foldername(name))[1] = public.current_user_org()::text
);
