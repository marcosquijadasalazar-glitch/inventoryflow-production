
CREATE TABLE IF NOT EXISTS public.organization_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL UNIQUE,
  timezone text,
  currency text,
  language text,
  default_location_id uuid,
  default_low_stock_threshold integer NOT NULL DEFAULT 5,
  scanner_auto_commit boolean NOT NULL DEFAULT false,
  scanner_sound boolean NOT NULL DEFAULT true,
  scanner_haptics boolean NOT NULL DEFAULT true,
  notify_low_stock boolean NOT NULL DEFAULT true,
  notify_transfers boolean NOT NULL DEFAULT true,
  notify_security boolean NOT NULL DEFAULT true,
  notify_billing boolean NOT NULL DEFAULT true,
  manager_can_edit_org_settings boolean NOT NULL DEFAULT false,
  contact_phone text,
  contact_email text,
  contact_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.organization_preferences TO authenticated;
GRANT ALL ON public.organization_preferences TO service_role;

ALTER TABLE public.organization_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read org_prefs"
ON public.organization_preferences
FOR SELECT
TO authenticated
USING (public.is_super_admin() OR organization_id = public.current_user_org());

CREATE POLICY "owner insert org_prefs"
ON public.organization_preferences
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin() OR (
    organization_id = public.current_user_org()
    AND public.current_user_role() = ANY (ARRAY['owner'::app_role, 'manager'::app_role])
  )
);

CREATE POLICY "owner or allowed manager update org_prefs"
ON public.organization_preferences
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin() OR (
    organization_id = public.current_user_org()
    AND (
      public.current_user_role() = 'owner'::app_role
      OR (
        public.current_user_role() = 'manager'::app_role
        AND manager_can_edit_org_settings = true
      )
    )
  )
)
WITH CHECK (
  public.is_super_admin() OR (
    organization_id = public.current_user_org()
    AND (
      public.current_user_role() = 'owner'::app_role
      OR (
        public.current_user_role() = 'manager'::app_role
        AND manager_can_edit_org_settings = true
      )
    )
  )
);

CREATE TRIGGER trg_org_prefs_updated_at
BEFORE UPDATE ON public.organization_preferences
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_org_prefs_org ON public.organization_preferences(organization_id);
