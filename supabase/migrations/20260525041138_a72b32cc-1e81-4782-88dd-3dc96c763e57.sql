-- Fix branding bucket policies: allow super_admin, keep owners scoped to their org folder.
DROP POLICY IF EXISTS "branding org-scoped insert" ON storage.objects;
DROP POLICY IF EXISTS "branding org-scoped update" ON storage.objects;
DROP POLICY IF EXISTS "branding org-scoped delete" ON storage.objects;
DROP POLICY IF EXISTS "branding read public" ON storage.objects;

-- Public read (bucket is public, but make policy explicit)
CREATE POLICY "branding read public"
ON storage.objects FOR SELECT
USING (bucket_id = 'branding');

CREATE POLICY "branding owner or super_admin insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'branding'
  AND (
    public.is_super_admin()
    OR (
      (storage.foldername(name))[1] = (public.current_user_org())::text
      AND public.current_user_role() IN ('owner','manager')
    )
  )
);

CREATE POLICY "branding owner or super_admin update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'branding'
  AND (
    public.is_super_admin()
    OR (
      (storage.foldername(name))[1] = (public.current_user_org())::text
      AND public.current_user_role() IN ('owner','manager')
    )
  )
)
WITH CHECK (
  bucket_id = 'branding'
  AND (
    public.is_super_admin()
    OR (
      (storage.foldername(name))[1] = (public.current_user_org())::text
      AND public.current_user_role() IN ('owner','manager')
    )
  )
);

CREATE POLICY "branding owner or super_admin delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'branding'
  AND (
    public.is_super_admin()
    OR (
      (storage.foldername(name))[1] = (public.current_user_org())::text
      AND public.current_user_role() IN ('owner','manager')
    )
  )
);
