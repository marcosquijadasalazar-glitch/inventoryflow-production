-- Approval workflow cleanup: cancel + soft delete support
ALTER TYPE public.approval_request_status ADD VALUE IF NOT EXISTS 'cancelled';

ALTER TABLE public.approval_requests
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

CREATE INDEX IF NOT EXISTS idx_approval_requests_not_deleted
  ON public.approval_requests(organization_id, status, created_at DESC)
  WHERE deleted_at IS NULL;
