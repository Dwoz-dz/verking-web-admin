-- Add admin_note + discount columns to orders (previously saved to KV fallback only).
-- Safe / additive migration.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS admin_note text DEFAULT '',
  ADD COLUMN IF NOT EXISTS discount   numeric(12,2) DEFAULT 0;

COMMENT ON COLUMN public.orders.admin_note IS 'Free-form internal note written by admin staff.';
COMMENT ON COLUMN public.orders.discount   IS 'Amount in local currency deducted from subtotal before shipping.';
