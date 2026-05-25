DROP POLICY IF EXISTS "owner write role_permissions" ON public.role_permissions;

CREATE POLICY "owner write role_permissions"
ON public.role_permissions
FOR ALL
TO authenticated
USING (
  is_super_admin()
  OR (
    can_manage_permissions(organization_id)
    AND role <> 'super_admin'::app_role
    AND (role <> 'owner'::app_role OR current_user_role() = 'owner'::app_role)
  )
)
WITH CHECK (
  is_super_admin()
  OR (
    can_manage_permissions(organization_id)
    AND role <> 'super_admin'::app_role
    AND (role <> 'owner'::app_role OR current_user_role() = 'owner'::app_role)
  )
);