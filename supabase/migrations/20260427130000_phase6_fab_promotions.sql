-- Phase 6 — FAB Promotional Dynamique.
--
-- Admin-orchestrated promotional pill that floats above the bottom
-- tab bar. The mobile picks ONE promo at a time per active screen,
-- using AND-targeting on cart total + wilaya + screen + auth state +
-- validity window. Highest-priority winner takes the slot; if no
-- candidate matches, the FAB hides cleanly (no default search button
-- in Phase 6 — the system intentionally goes silent rather than
-- forcing irrelevant content).
--
-- Link semantics (resolved client-side):
--   ▸ coupons      → /coupons
--   ▸ themed_page  → /page/<link_target>          (slug)
--   ▸ product      → /product/<link_target>       (uuid)
--   ▸ category     → /(tabs)/explore?categoryId=<link_target>
--   ▸ flash_sale   → /(tabs)/explore?theme=economies (heuristic for now)
--   ▸ external     → ignored (not opened in v1 for security)
--   ▸ none         → just display, no navigation

CREATE TABLE IF NOT EXISTS public.mobile_fab_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  label_fr TEXT NOT NULL,
  label_ar TEXT NOT NULL,

  -- Visual
  bg_color TEXT NOT NULL DEFAULT '#22C55E',
  text_color TEXT NOT NULL DEFAULT '#FFFFFF',
  icon TEXT,                                       -- emoji or Ionicons name

  -- Linking
  link_type TEXT NOT NULL DEFAULT 'none' CHECK (link_type IN ('coupons','flash_sale','category','product','themed_page','external','none')),
  link_target TEXT,

  -- Conditions (NULL/empty = wildcard — AND-combined)
  min_cart_amount NUMERIC,
  max_cart_amount NUMERIC,
  target_wilayas TEXT[],
  target_user_segment TEXT,
  target_screens TEXT[],                           -- 'home','search','profile','cart' — empty = all
  show_only_logged_in BOOLEAN NOT NULL DEFAULT FALSE,
  show_only_logged_out BOOLEAN NOT NULL DEFAULT FALSE,

  -- Validity & ranking
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  priority INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Metrics — bumped by public edge routes, surfaced in admin
  impressions_count INT NOT NULL DEFAULT 0,
  clicks_count INT NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (max_cart_amount IS NULL OR min_cart_amount IS NULL OR max_cart_amount >= min_cart_amount),
  CHECK (NOT (show_only_logged_in AND show_only_logged_out))
);

CREATE INDEX IF NOT EXISTS mobile_fab_promotions_active_idx   ON public.mobile_fab_promotions (is_active) WHERE is_active;
CREATE INDEX IF NOT EXISTS mobile_fab_promotions_priority_idx ON public.mobile_fab_promotions (priority DESC);
CREATE INDEX IF NOT EXISTS mobile_fab_promotions_window_idx   ON public.mobile_fab_promotions (starts_at, ends_at);

COMMENT ON TABLE public.mobile_fab_promotions IS
  'Floating promotional pill shown above the bottom tab bar. Mobile filters client-side by current cart_total + wilaya + screen + auth state.';

ALTER TABLE public.mobile_fab_promotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fab_promos_anon_read   ON public.mobile_fab_promotions;
DROP POLICY IF EXISTS fab_promos_authed_read ON public.mobile_fab_promotions;

-- Anon SELECT auto-filters by validity window. The mobile then
-- applies the per-context filters (cart, wilaya, etc.) client-side.
CREATE POLICY fab_promos_anon_read ON public.mobile_fab_promotions FOR SELECT TO anon USING (
  is_active = TRUE
  AND (starts_at IS NULL OR starts_at <= NOW())
  AND (ends_at   IS NULL OR ends_at   >= NOW())
);
CREATE POLICY fab_promos_authed_read ON public.mobile_fab_promotions FOR SELECT TO authenticated USING (
  is_active = TRUE
  AND (starts_at IS NULL OR starts_at <= NOW())
  AND (ends_at   IS NULL OR ends_at   >= NOW())
);

CREATE OR REPLACE FUNCTION public._mobile_fab_promotions_touch()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS mobile_fab_promotions_touch ON public.mobile_fab_promotions;
CREATE TRIGGER mobile_fab_promotions_touch
  BEFORE UPDATE ON public.mobile_fab_promotions
  FOR EACH ROW EXECUTE FUNCTION public._mobile_fab_promotions_touch();


-- ─── Realtime ───────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='mobile_fab_promotions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mobile_fab_promotions;
  END IF;
END
$$;

ALTER TABLE public.mobile_fab_promotions REPLICA IDENTITY FULL;


-- ─── Seed: 3 starter promos covering each link_type ──────────────────────
INSERT INTO public.mobile_fab_promotions (
  label_fr, label_ar, bg_color, text_color, icon,
  link_type, link_target,
  target_screens, priority
) VALUES
  ('Coupons disponibles', 'كوبونات متاحة',
   '#FF7A1A', '#FFFFFF', 'pricetag',
   'coupons', NULL,
   ARRAY['home','search','profile'], 90),

  ('🎒 Pack Rentrée', '🎒 حزمة الدخول',
   '#4CAF80', '#FFFFFF', 'school',
   'themed_page', 'rentree',
   ARRAY['home','search'], 80),

  ('💰 Économies en cours', '💰 تخفيضات جارية',
   '#E85D6B', '#FFFFFF', 'flame',
   'themed_page', 'economies',
   ARRAY['home','search'], 70)
ON CONFLICT DO NOTHING;
