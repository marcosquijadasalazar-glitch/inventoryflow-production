-- Approval policies (org-scoped, per action_type)
CREATE TYPE public.approval_action_type AS ENUM (
  'stock_adjustment',
  'transfer_order',
  'product_deletion',
  'role_change',
  'large_import'
);

CREATE TYPE public.approval_required_role AS ENUM ('manager', 'owner');

CREATE TYPE public.approval_request_status AS ENUM ('pending', 'approved', 'rejected', 'expired');

CREATE TABLE public.approval_policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  action_type public.approval_action_type NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  threshold_qty INTEGER,
  threshold_value NUMERIC,
  required_role public.approval_required_role NOT NULL DEFAULT 'manager',
  block_completely BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, action_type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.approval_policies TO authenticated;
GRANT ALL ON public.approval_policies TO service_role;

ALTER TABLE public.approval_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org read approval_policies"
ON public.approval_policies FOR SELECT TO authenticated
USING (is_super_admin() OR organization_id = current_user_org());

CREATE POLICY "owner manager write approval_policies"
ON public.approval_policies FOR ALL TO authenticated
USING (is_super_admin() OR (organization_id = current_user_org() AND current_user_role() IN ('owner','manager')))
WITH CHECK (is_super_admin() OR (organization_id = current_user_org() AND current_user_role() IN ('owner','manager')));

CREATE TRIGGER trg_approval_policies_updated
BEFORE UPDATE ON public.approval_policies
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Approval requests (audit trail + async queue)
CREATE TABLE public.approval_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  action_type public.approval_action_type NOT NULL,
  status public.approval_request_status NOT NULL DEFAULT 'pending',
  requested_by UUID,
  requested_by_email TEXT,
  approved_by UUID,
  approved_by_email TEXT,
  reason TEXT,
  decision_note TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  threshold_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  entity_label TEXT,
  same_session BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '48 hours')
);

GRANT SELECT, INSERT, UPDATE ON public.approval_requests TO authenticated;
GRANT ALL ON public.approval_requests TO service_role;

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

-- All org members can read requests for visibility (owners/managers act on them)
CREATE POLICY "org read approval_requests"
ON public.approval_requests FOR SELECT TO authenticated
USING (is_super_admin() OR organization_id = current_user_org());

-- Org members can insert their own requests
CREATE POLICY "org insert approval_requests"
ON public.approval_requests FOR INSERT TO authenticated
WITH CHECK (is_super_admin() OR organization_id = current_user_org());

-- Only owners/managers can update (decide) requests
CREATE POLICY "owner manager decide approval_requests"
ON public.approval_requests FOR UPDATE TO authenticated
USING (is_super_admin() OR (organization_id = current_user_org() AND current_user_role() IN ('owner','manager')))
WITH CHECK (is_super_admin() OR (organization_id = current_user_org() AND current_user_role() IN ('owner','manager')));

CREATE INDEX idx_approval_requests_org_status ON public.approval_requests(organization_id, status, created_at DESC);
CREATE INDEX idx_approval_requests_action ON public.approval_requests(organization_id, action_type, created_at DESC);