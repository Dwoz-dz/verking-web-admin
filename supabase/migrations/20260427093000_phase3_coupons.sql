-- Phase 3 — Coupons + Wallet + Auto-Apply.
--
-- Three tables:
--   1. mobile_coupons             — admin-defined coupon catalogue.
--   2. mobile_user_coupons        — wallet (claimed-but-not-used).
--   3. mobile_coupon_redemptions  — immutable usage log.
--
-- Identity: pre-auth, ownership is keyed by `device_id`. Post-auth
-- (Phase 2A) the migration script will backfill `user_id` and clear
-- the device-only rows.

-- ─── 1. Catalogue ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mobile_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  title_fr TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  description_fr TEXT,
  description_ar TEXT,

  -- Discount mechanics
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent','fixed','free_shipping')),
  value NUMERIC NOT NULL CHECK (value >= 0),
  max_discount NUMERIC CHECK (max_discount IS NULL OR max_discount >= 0),
  min_cart_amount NUMERIC NOT NULL DEFAULT 0 CHECK (min_cart_amount >= 0),

  -- Usage limits
  max_uses INT CHECK (max_uses IS NULL OR max_uses >= 0),
  uses_count INT NOT NULL DEFAULT 0 CHECK (uses_count >= 0),
  max_uses_per_user INT NOT NULL DEFAULT 1 CHECK (max_uses_per_user >= 1),

  -- Targeting (NULL/empty arrays = "all")
  target_category_ids UUID[],
  target_product_ids UUID[],
  target_wilayas TEXT[],
  target_user_segment TEXT,                  -- 'new','returning','vip','wholesale'
  target_school_levels TEXT[],               -- Phase 9 hookup

  -- Validity window
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Provenance — where the coupon came from
  source TEXT NOT NULL DEFAULT 'manual',     -- 'manual','rewards','referral','challenge','flash_sale'

  -- UI hints
  banner_image TEXT,
  display_priority INT NOT NULL DEFAULT 0,
  is_claimable BOOLEAN NOT NULL DEFAULT TRUE,         -- shown in the public wallet hub
  is_auto_applicable BOOLEAN NOT NULL DEFAULT TRUE,   -- considered by best-coupon engine

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mobile_coupons_active_idx       ON public.mobile_coupons (is_active);
CREATE INDEX IF NOT EXISTS mobile_coupons_claimable_idx    ON public.mobile_coupons (is_claimable) WHERE is_active;
CREATE INDEX IF NOT EXISTS mobile_coupons_priority_idx     ON public.mobile_coupons (display_priority DESC);
CREATE INDEX IF NOT EXISTS mobile_coupons_window_idx       ON public.mobile_coupons (starts_at, ends_at);

COMMENT ON TABLE public.mobile_coupons IS
  'Admin-defined coupon catalogue. Targeting columns are nullable arrays — empty/null means "applies to all". The best-coupon engine consults is_auto_applicable.';

ALTER TABLE public.mobile_coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coupons_anon_read   ON public.mobile_coupons;
DROP POLICY IF EXISTS coupons_authed_read ON public.mobile_coupons;

-- Anon SELECT only sees coupons that are active AND within their
-- validity window AND flagged claimable. Admin reads all rows via the
-- service-role from the admin UI (Phase 3.4).
CREATE POLICY coupons_anon_read ON public.mobile_coupons FOR SELECT TO anon USING (
  is_active = TRUE
  AND is_claimable = TRUE
  AND (starts_at IS NULL OR starts_at <= NOW())
  AND (ends_at IS NULL OR ends_at >= NOW())
);
CREATE POLICY coupons_authed_read ON public.mobile_coupons FOR SELECT TO authenticated USING (
  is_active = TRUE
  AND is_claimable = TRUE
  AND (starts_at IS NULL OR starts_at <= NOW())
  AND (ends_at IS NULL OR ends_at >= NOW())
);

CREATE OR REPLACE FUNCTION public._mobile_coupons_touch()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS mobile_coupons_touch ON public.mobile_coupons;
CREATE TRIGGER mobile_coupons_touch
  BEFORE UPDATE ON public.mobile_coupons
  FOR EACH ROW EXECUTE FUNCTION public._mobile_coupons_touch();


-- ─── 2. Wallet ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mobile_user_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,                              -- post-auth
  device_id TEXT,                            -- pre-auth
  coupon_id UUID NOT NULL REFERENCES public.mobile_coupons(id) ON DELETE CASCADE,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at TIMESTAMPTZ,
  used_in_order_id UUID,                     -- FK back to orders, nullable
  CONSTRAINT user_coupons_owner_check CHECK (user_id IS NOT NULL OR device_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS user_coupons_user_unique
  ON public.mobile_user_coupons (user_id, coupon_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS user_coupons_device_unique
  ON public.mobile_user_coupons (device_id, coupon_id) WHERE device_id IS NOT NULL AND user_id IS NULL;
CREATE INDEX IF NOT EXISTS user_coupons_unused_idx
  ON public.mobile_user_coupons (used_at) WHERE used_at IS NULL;

COMMENT ON TABLE public.mobile_user_coupons IS
  'Per-user/device claimed coupons (the "Wallet"). Unique per (owner, coupon_id) so a stray double-claim is a no-op.';

ALTER TABLE public.mobile_user_coupons ENABLE ROW LEVEL SECURITY;
-- Phase 3 keeps wallet writes service-role only (via admin-mobile-config
-- /coupon-claim). Reads also go through the edge function for now.


-- ─── 3. Redemption log ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mobile_coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES public.mobile_coupons(id) ON DELETE CASCADE,
  user_id UUID,
  device_id TEXT,
  order_id UUID,                             -- FK loose (orders may live in a different schema later)
  discount_applied NUMERIC NOT NULL CHECK (discount_applied >= 0),
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS coupon_redemptions_coupon_idx ON public.mobile_coupon_redemptions (coupon_id);
CREATE INDEX IF NOT EXISTS coupon_redemptions_user_idx   ON public.mobile_coupon_redemptions (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS coupon_redemptions_device_idx ON public.mobile_coupon_redemptions (device_id) WHERE device_id IS NOT NULL;

COMMENT ON TABLE public.mobile_coupon_redemptions IS
  'Immutable log of every coupon application. Powers admin stats and the per-user-limit check at claim time.';

ALTER TABLE public.mobile_coupon_redemptions ENABLE ROW LEVEL SECURITY;
-- Service-role only.


-- ─── Realtime + REPLICA IDENTITY ─────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='mobile_coupons') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mobile_coupons;
  END IF;
END
$$;

ALTER TABLE public.mobile_coupons REPLICA IDENTITY FULL;


-- ─── Seed: 3 demo coupons so the screen has content out of the box ──
INSERT INTO public.mobile_coupons (code, title_fr, title_ar, description_fr, description_ar, discount_type, value, min_cart_amount, max_uses_per_user, source, display_priority)
VALUES
  ('RENTREE500',  'Rentrée -500 DA', 'الدخول المدرسي -500 دج',
   'Réduction de 500 DA dès 3000 DA d''achat — pour préparer la rentrée.',
   'خصم 500 دج ابتداءً من 3000 دج — لتحضير الدخول المدرسي.',
   'fixed',         500, 3000, 1, 'manual', 100),
  ('GROS10',      'Gros -10 %',      'الجملة -10٪',
   '10 % de réduction sur la commande — applicable au mode Gros.',
   '10٪ خصم على الطلب — للبيع بالجملة.',
   'percent',        10,    0, 1, 'manual',  80),
  ('FREESHIP',    'Livraison offerte', 'توصيل مجاني',
   'Livraison gratuite dès 4000 DA — toutes wilayas.',
   'توصيل مجاني ابتداءً من 4000 دج — لكل الولايات.',
   'free_shipping',   0, 4000, 1, 'manual',  70)
ON CONFLICT (code) DO NOTHING;
