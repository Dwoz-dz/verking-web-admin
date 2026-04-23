-- Admin note + updated_at on wholesale_requests
-- The admin UI (AdminWholesale.tsx) saves `admin_note` and toggles status.
-- Previously the backend silently dropped the note because the column did
-- not exist and wrote the status without timestamping the change.

ALTER TABLE public.wholesale_requests
  ADD COLUMN IF NOT EXISTS admin_note text DEFAULT '',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.wholesale_requests.admin_note IS 'Free-form internal note written by admin staff about this wholesale lead.';
