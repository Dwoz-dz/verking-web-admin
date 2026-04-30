-- Phase 4 — Flash Sales.
--
-- Admin-orchestrated timed discount campaigns over a curated set of
-- products. The mobile Home reads the active sales, applies the
-- displayed countdown, and overrides each product's effective price
-- by the campaign's discount. Sales auto-disappear once `ends_at`
-- has passed (RLS filter does the work — no client-side culling).
--
-- Pricing model is intentionally simpler than mobile_coupons:
--   ▸ One discount per sale (percent OR fixed DA off).
--   ▸ Applied to every product in `product_ids` for the sale duration.
--   ▸ `max_qty_per_user` lets the admin throttle abuse.
--   ▸ `total_stock_override` is a soft cap on the sale (independent
--     from product.stock) — null means "use whatever stock the
--     product has".

CREATE TABLE IF NOT EXISTS public.mobile_flash_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  title_fr TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  subtitle_fr TEXT,
  subtitle_ar TEXT,
  banner_image TEXT,

  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent','fixed')),
  discount_value NUMERIC NOT NULL CHECK (discount_value >= 0),

  product_ids UUID[] NOT NULL DEFAULT '{}',
  max_qty_per_user INT NOT NULL DEFAULT 5 CHECK (max_qty_per_user >= 1),
  total_stock_override INT CHECK (total_stock_override IS NULL OR total_stock_override >= 0),

  starts_at TIMESTAMPTZ NOT NULL,
  ends_at   TIMESTAMPTZ NOT NULL,
  CHECK (ends_at > starts_at),

  display_priority INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Targeting (NULL/empty = "everyone")
  target_wilayas TEXT[],
  target_user_segment TEXT,
  target_school_levels TEXT[],

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mobile_flash_sales_active_idx     ON public.mobile_flash_sales (is_active) WHERE is_active;
CREATE INDEX IF NOT EXISTS mobile_flash_sales_window_idx     ON public.mobile_flash_sales (starts_at, ends_at);
CREATE INDEX IF NOT EXISTS mobile_flash_sales_priority_idx   ON public.mobile_flash_sales (display_priority DESC);

COMMENT ON TABLE public.mobile_flash_sales IS
  'Admin-orchestrated timed discount campaigns over a set of products. Anon SELECT auto-filters expired/inactive rows.';

ALTER TABLE public.mobile_flash_sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS flash_sales_anon_read   ON public.mobile_flash_sales;
DROP POLICY IF EXISTS flash_sales_authed_read ON public.mobile_flash_sales;

-- Anon SELECT only sees active sales whose validity window contains NOW.
CREATE POLICY flash_sales_anon_read ON public.mobile_flash_sales FOR SELECT TO anon USING (
  is_active = TRUE
  AND starts_at <= NOW()
  AND ends_at >= NOW()
);
CREATE POLICY flash_sales_authed_read ON public.mobile_flash_sales FOR SELECT TO authenticated USING (
  is_active = TRUE
  AND starts_at <= NOW()
  AND ends_at >= NOW()
);

CREATE OR REPLACE FUNCTION public._mobile_flash_sales_touch()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS mobile_flash_sales_touch ON public.mobile_flash_sales;
CREATE TRIGGER mobile_flash_sales_touch
  BEFORE UPDATE ON public.mobile_flash_sales
  FOR EACH ROW EXECUTE FUNCTION public._mobile_flash_sales_touch();


-- ─── Realtime ───────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='mobile_flash_sales'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mobile_flash_sales;
  END IF;
END
$$;

ALTER TABLE public.mobile_flash_sales REPLICA IDENTITY FULL;


-- ─── Seed: one live demo flash sale spanning today + 7 days ─────────────
-- Picks the 2 most recently created active products. Skipped silently
-- if the catalogue is empty.
DO $$
DECLARE
  pids UUID[];
BEGIN
  SELECT array_agg(id) INTO pids FROM (
    SELECT id FROM public.products WHERE is_active = TRUE ORDER BY created_at DESC LIMIT 2
  ) t;

  IF pids IS NOT NULL AND array_length(pids, 1) > 0 THEN
    INSERT INTO public.mobile_flash_sales (
      title_fr, title_ar, subtitle_fr, subtitle_ar,
      discount_type, discount_value,
      product_ids, max_qty_per_user,
      starts_at, ends_at, display_priority
    ) VALUES (
      'Flash Cartables -20%', 'تخفيض المحافظ -20٪',
      'Promo limitée — préparez la rentrée', 'عرض محدود — جهّز الدخول المدرسي',
      'percent', 20,
      pids, 3,
      NOW() - INTERVAL '5 minutes',
      NOW() + INTERVAL '7 days',
      90
    )
    ON CONFLICT DO NOTHING;
  END IF;
END
$$;
