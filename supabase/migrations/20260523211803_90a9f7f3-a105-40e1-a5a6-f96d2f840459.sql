REVOKE EXECUTE ON FUNCTION public.org_plan_usage(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_module_enabled(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.enforce_plan_limit() FROM PUBLIC, anon;