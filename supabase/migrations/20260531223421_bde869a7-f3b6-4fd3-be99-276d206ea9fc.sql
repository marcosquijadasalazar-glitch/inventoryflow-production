
ALTER TYPE public.transfer_status ADD VALUE IF NOT EXISTS 'pending_approval';
ALTER TYPE public.transfer_status ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE public.transfer_status ADD VALUE IF NOT EXISTS 'rejected';
