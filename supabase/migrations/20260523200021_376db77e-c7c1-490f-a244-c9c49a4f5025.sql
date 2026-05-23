DROP POLICY "owner delete org profiles" ON public.profiles;
DROP POLICY "owner read org profiles" ON public.profiles;
DROP POLICY "owner update org profiles" ON public.profiles;
DROP POLICY "self insert own profile" ON public.profiles;

CREATE POLICY "owner delete org profiles" ON public.profiles
  FOR DELETE TO authenticated
  USING ((organization_id = current_user_org()) AND (current_user_role() = ANY (ARRAY['owner'::app_role, 'manager'::app_role])));

CREATE POLICY "owner read org profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING ((organization_id = current_user_org()) AND (current_user_role() = ANY (ARRAY['owner'::app_role, 'manager'::app_role])));

CREATE POLICY "owner update org profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING ((organization_id = current_user_org()) AND (current_user_role() = ANY (ARRAY['owner'::app_role, 'manager'::app_role])))
  WITH CHECK ((organization_id = current_user_org()) AND (current_user_role() = ANY (ARRAY['owner'::app_role, 'manager'::app_role])) AND (role <> 'super_admin'::app_role));

CREATE POLICY "self insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK ((user_id = auth.uid()) AND (role = 'employee'::app_role));