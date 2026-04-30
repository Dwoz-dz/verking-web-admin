-- Phase 5 — Themed Pages.
--
-- Curated landing pages composed of admin-orchestrated sections.
-- The mobile app shows a horizontal strip of active pages on Home;
-- tapping a page navigates to `app/page/[slug].tsx`, which renders
-- the hero (image + optional countdown + CTA) followed by every
-- section in the JSONB array.
--
-- Section JSONB shape (all keys optional except `type`):
--   { type:'banner',      image, link, title_fr, title_ar }
--   { type:'products',    title_fr, title_ar, filter:{ category_id?, tag?, level?, limit? } }
--   { type:'coupons',     title_fr, title_ar, coupon_ids:[uuid] }
--   { type:'flash_sales', title_fr, title_ar }
--   { type:'rail',        title_fr, title_ar, product_ids:[uuid] }
--
-- The mobile renderer ignores unknown types — admins can add more
-- block kinds without a code release once the renderer learns them.

CREATE TABLE IF NOT EXISTS public.mobile_themed_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,                -- 'rentree','economies','gros'
  title_fr TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  tab_emoji TEXT,                           -- shown on the strip pill
  tab_color TEXT,                           -- hex color for active state

  -- Hero (top of the themed page)
  hero_banner_image TEXT,
  hero_title_fr TEXT, hero_title_ar TEXT,
  hero_subtitle_fr TEXT, hero_subtitle_ar TEXT,
  hero_countdown_ends_at TIMESTAMPTZ,
  hero_cta_label_fr TEXT, hero_cta_label_ar TEXT,
  hero_cta_link TEXT,

  -- Body
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Visibility
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,

  -- Targeting
  target_wilayas TEXT[],
  target_school_levels TEXT[],

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mobile_themed_pages_active_idx ON public.mobile_themed_pages (is_active) WHERE is_active;
CREATE INDEX IF NOT EXISTS mobile_themed_pages_sort_idx   ON public.mobile_themed_pages (sort_order);
CREATE INDEX IF NOT EXISTS mobile_themed_pages_window_idx ON public.mobile_themed_pages (starts_at, ends_at);

COMMENT ON TABLE public.mobile_themed_pages IS
  'Curated landing pages with hero + JSONB sections. Anon SELECT auto-filters inactive/expired rows.';

ALTER TABLE public.mobile_themed_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS themed_pages_anon_read   ON public.mobile_themed_pages;
DROP POLICY IF EXISTS themed_pages_authed_read ON public.mobile_themed_pages;

CREATE POLICY themed_pages_anon_read ON public.mobile_themed_pages FOR SELECT TO anon USING (
  is_active = TRUE
  AND (starts_at IS NULL OR starts_at <= NOW())
  AND (ends_at   IS NULL OR ends_at   >= NOW())
);
CREATE POLICY themed_pages_authed_read ON public.mobile_themed_pages FOR SELECT TO authenticated USING (
  is_active = TRUE
  AND (starts_at IS NULL OR starts_at <= NOW())
  AND (ends_at   IS NULL OR ends_at   >= NOW())
);

CREATE OR REPLACE FUNCTION public._mobile_themed_pages_touch()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS mobile_themed_pages_touch ON public.mobile_themed_pages;
CREATE TRIGGER mobile_themed_pages_touch
  BEFORE UPDATE ON public.mobile_themed_pages
  FOR EACH ROW EXECUTE FUNCTION public._mobile_themed_pages_touch();


-- ─── Realtime ───────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='mobile_themed_pages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mobile_themed_pages;
  END IF;
END
$$;
ALTER TABLE public.mobile_themed_pages REPLICA IDENTITY FULL;


-- ─── Seed: 3 starter themed pages ────────────────────────────────────────
INSERT INTO public.mobile_themed_pages (
  slug, title_fr, title_ar, tab_emoji, tab_color, sort_order,
  hero_title_fr, hero_title_ar, hero_subtitle_fr, hero_subtitle_ar,
  hero_cta_label_fr, hero_cta_label_ar, hero_cta_link,
  sections
) VALUES
  ('rentree',
   'Rentrée scolaire', 'الدخول المدرسي',
   '🎒', '#4CAF80', 100,
   'Préparez la rentrée 2026', 'استعد للدخول المدرسي 2026',
   'Cartables, cahiers, stylos — tout pour bien démarrer.', 'محافظ، كراريس، أقلام — كل ما تحتاج للبداية.',
   'Voir tous les produits', 'عرض جميع المنتجات', '/(tabs)/explore',
   '[
     {"type":"products","title_fr":"Top rentrée","title_ar":"الأكثر مبيعاً للدخول","filter":{"limit":8}},
     {"type":"flash_sales","title_fr":"Offres flash en cours","title_ar":"عروض فلاش جارية"},
     {"type":"coupons","title_fr":"Coupons disponibles","title_ar":"كوبونات متاحة"}
   ]'::jsonb),

  ('economies',
   'Économies', 'تخفيضات',
   '💰', '#FF7A1A', 90,
   'Jusqu''à -60 % sur des centaines de produits', 'حتى -60٪ على مئات المنتجات',
   'Réductions actives — promo limitée.', 'تخفيضات جارية — عرض محدود.',
   'Voir les offres', 'شاهد العروض', '/(tabs)/explore?theme=economies',
   '[
     {"type":"flash_sales","title_fr":"Offres flash","title_ar":"عروض فلاش"},
     {"type":"products","title_fr":"En promotion","title_ar":"بتخفيض","filter":{"limit":12}},
     {"type":"coupons","title_fr":"Coupons à réclamer","title_ar":"كوبونات للحصول عليها"}
   ]'::jsonb),

  ('gros',
   'Spécial Gros', 'عرض الجملة',
   '📦', '#43D9DB', 80,
   'Tarifs revendeurs', 'أسعار للموزعين',
   'Achetez en quantité, économisez plus.', 'اشتر بالجملة ووفّر أكثر.',
   'Voir le catalogue Gros', 'عرض كتالوج الجملة', '/(tabs)/explore?theme=gros',
   '[
     {"type":"banner","title_fr":"Devenez revendeur","title_ar":"كن موزعاً","image":null,"link":"/wholesale"},
     {"type":"products","title_fr":"Produits Gros","title_ar":"منتجات بالجملة","filter":{"limit":12}}
   ]'::jsonb)
ON CONFLICT (slug) DO NOTHING;
