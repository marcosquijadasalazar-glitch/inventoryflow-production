
-- Notification type enum
DO $$ BEGIN
  CREATE TYPE public.notification_type AS ENUM (
    'low_stock','payment_failed','trial_ending','user_created','role_changed','system'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid,
  type public.notification_type NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_org_created_idx
  ON public.notifications (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS notifications_org_unread_idx
  ON public.notifications (organization_id) WHERE read = false;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org read notifications" ON public.notifications;
CREATE POLICY "org read notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR (
      organization_id = public.current_user_org()
      AND (user_id IS NULL OR user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "org update notifications" ON public.notifications;
CREATE POLICY "org update notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (
    public.is_super_admin()
    OR (
      organization_id = public.current_user_org()
      AND (user_id IS NULL OR user_id = auth.uid())
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      organization_id = public.current_user_org()
      AND (user_id IS NULL OR user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "super_admin all notifications" ON public.notifications;
CREATE POLICY "super_admin all notifications"
  ON public.notifications FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Trigger: when a low_stock transaction is logged, create an org-wide notification.
CREATE OR REPLACE FUNCTION public.notify_on_low_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_exists boolean;
BEGIN
  IF NEW.type <> 'low_stock' THEN RETURN NEW; END IF;
  IF NEW.organization_id IS NULL THEN RETURN NEW; END IF;

  -- Throttle: skip if a low_stock notification for the same product was raised
  -- in the last 6 hours, to avoid spam from repeated movements.
  SELECT EXISTS(
    SELECT 1 FROM public.notifications
    WHERE organization_id = NEW.organization_id
      AND type = 'low_stock'
      AND (metadata ->> 'product_id') = NEW.product_id::text
      AND created_at > now() - interval '6 hours'
  ) INTO recent_exists;
  IF recent_exists THEN RETURN NEW; END IF;

  INSERT INTO public.notifications (organization_id, user_id, type, title, message, metadata)
  VALUES (
    NEW.organization_id,
    NULL,
    'low_stock',
    'Low stock alert',
    'Low stock: ' || COALESCE(NEW.product_name, 'Product') ||
      ' only has ' || COALESCE(NEW.new_stock, 0)::text || ' units remaining.',
    jsonb_build_object(
      'product_id', NEW.product_id,
      'product_name', NEW.product_name,
      'sku', NEW.sku,
      'new_stock', NEW.new_stock
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_low_stock ON public.transaction_history;
CREATE TRIGGER trg_notify_low_stock
AFTER INSERT ON public.transaction_history
FOR EACH ROW EXECUTE FUNCTION public.notify_on_low_stock();
