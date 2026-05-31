
CREATE TABLE public.operational_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  action_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  entity_label text,
  summary text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id uuid,
  actor_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_op_audit_org_created ON public.operational_audit_log(organization_id, created_at DESC);
CREATE INDEX idx_op_audit_entity ON public.operational_audit_log(entity_type, entity_id);
CREATE INDEX idx_op_audit_actor ON public.operational_audit_log(actor_user_id);
CREATE INDEX idx_op_audit_action ON public.operational_audit_log(action_type);

GRANT SELECT, INSERT ON public.operational_audit_log TO authenticated;
GRANT ALL ON public.operational_audit_log TO service_role;

ALTER TABLE public.operational_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org owners/managers read op audit"
ON public.operational_audit_log FOR SELECT
TO authenticated
USING (
  public.is_super_admin()
  OR (
    organization_id = public.current_user_org()
    AND public.current_user_role() = ANY (ARRAY['owner'::app_role, 'manager'::app_role])
  )
);

CREATE POLICY "org members insert op audit"
ON public.operational_audit_log FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR (organization_id IS NULL OR organization_id = public.current_user_org())
);

-- Reusable trigger function
CREATE OR REPLACE FUNCTION public.log_operational_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_entity text := TG_TABLE_NAME;
  v_entity_id uuid;
  v_label text;
  v_summary text;
  v_org uuid;
  v_meta jsonb := '{}'::jsonb;
  v_uid uuid := auth.uid();
  v_email text;
  v_rec record;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_rec := OLD;
  ELSE
    v_rec := NEW;
  END IF;

  BEGIN v_entity_id := (to_jsonb(v_rec) ->> 'id')::uuid; EXCEPTION WHEN OTHERS THEN v_entity_id := NULL; END;
  BEGIN v_org := (to_jsonb(v_rec) ->> 'organization_id')::uuid; EXCEPTION WHEN OTHERS THEN v_org := NULL; END;

  IF v_uid IS NOT NULL THEN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  END IF;

  IF TG_TABLE_NAME = 'products' THEN
    v_label := COALESCE((to_jsonb(v_rec) ->> 'name'), (to_jsonb(v_rec) ->> 'sku'));
    IF TG_OP = 'INSERT' THEN
      v_action := 'product_created';
      v_summary := 'Created product ' || COALESCE(v_label, '');
    ELSIF TG_OP = 'UPDATE' THEN
      v_action := 'product_updated';
      v_summary := 'Updated product ' || COALESCE(v_label, '');
      v_meta := jsonb_build_object(
        'stock_before', OLD.stock, 'stock_after', NEW.stock,
        'price_before', OLD.price, 'price_after', NEW.price
      );
    ELSE
      v_action := 'product_deleted';
      v_summary := 'Deleted product ' || COALESCE(v_label, '');
    END IF;

  ELSIF TG_TABLE_NAME = 'inventory_movements' AND TG_OP = 'INSERT' THEN
    v_action := CASE
      WHEN NEW.note ILIKE '[scan]%' THEN 'scanner_activity'
      WHEN NEW.type = 'adjustment' THEN 'inventory_adjusted'
      WHEN NEW.type = 'add' THEN 'inventory_added'
      WHEN NEW.type = 'remove' THEN 'inventory_removed'
      ELSE 'inventory_movement'
    END;
    SELECT name INTO v_label FROM public.products WHERE id = NEW.product_id;
    v_summary := COALESCE(v_label, 'Product') || ' ' || NEW.type::text || ' qty ' || NEW.quantity::text;
    v_meta := jsonb_build_object('product_id', NEW.product_id, 'type', NEW.type, 'quantity', NEW.quantity, 'note', NEW.note);
    v_entity := 'product';
    v_entity_id := NEW.product_id;

  ELSIF TG_TABLE_NAME = 'transfer_orders' THEN
    v_label := NEW.transfer_number;
    IF TG_OP = 'INSERT' THEN
      v_action := 'transfer_created';
      v_summary := 'Created transfer ' || COALESCE(v_label, '');
    ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
      v_action := 'transfer_status_changed';
      v_summary := 'Transfer ' || COALESCE(v_label, '') || ' → ' || NEW.status::text;
      v_meta := jsonb_build_object('from_status', OLD.status, 'to_status', NEW.status);
      IF NEW.status::text = 'completed' THEN v_action := 'transfer_completed'; END IF;
    ELSE
      RETURN NEW;
    END IF;

  ELSIF TG_TABLE_NAME = 'locations' THEN
    v_label := COALESCE((to_jsonb(v_rec) ->> 'name'), (to_jsonb(v_rec) ->> 'code'));
    IF TG_OP = 'INSERT' THEN
      v_action := 'location_created';
      v_summary := 'Created ' || COALESCE(NEW.node_level, 'location') || ' ' || COALESCE(v_label, '');
    ELSIF TG_OP = 'UPDATE' THEN
      v_action := 'location_updated';
      v_summary := 'Updated location ' || COALESCE(v_label, '');
    ELSE
      v_action := 'location_deleted';
      v_summary := 'Deleted location ' || COALESCE(v_label, '');
    END IF;

  ELSIF TG_TABLE_NAME = 'profiles' AND TG_OP = 'UPDATE' AND OLD.role IS DISTINCT FROM NEW.role THEN
    v_action := 'role_changed';
    v_entity := 'profile';
    v_label := COALESCE(NEW.full_name, NEW.email);
    v_summary := COALESCE(v_label, 'User') || ' role: ' || OLD.role::text || ' → ' || NEW.role::text;
    v_meta := jsonb_build_object('from_role', OLD.role, 'to_role', NEW.role, 'target_user_id', NEW.user_id);
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.operational_audit_log
    (organization_id, action_type, entity_type, entity_id, entity_label, summary, metadata, actor_user_id, actor_email)
  VALUES
    (v_org, v_action, v_entity, v_entity_id, v_label, v_summary, COALESCE(v_meta, '{}'::jsonb), v_uid, v_email);

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_op_audit_products
AFTER INSERT OR UPDATE OR DELETE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.log_operational_event();

CREATE TRIGGER trg_op_audit_inventory_movements
AFTER INSERT ON public.inventory_movements
FOR EACH ROW EXECUTE FUNCTION public.log_operational_event();

CREATE TRIGGER trg_op_audit_transfer_orders
AFTER INSERT OR UPDATE ON public.transfer_orders
FOR EACH ROW EXECUTE FUNCTION public.log_operational_event();

CREATE TRIGGER trg_op_audit_locations
AFTER INSERT OR UPDATE OR DELETE ON public.locations
FOR EACH ROW EXECUTE FUNCTION public.log_operational_event();

CREATE TRIGGER trg_op_audit_profiles_role
AFTER UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.log_operational_event();
