REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, public.app_permission) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_permissions(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.audit_permission_change() FROM PUBLIC, anon, authenticated;