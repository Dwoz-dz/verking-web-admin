-- Phase 7 — Trust signals + Smart Empty States.
--
-- Two structural changes:
--
--   1. mobile_cart_settings gains a `trust_signals` JSONB array. The
--      mobile <TrustStrip /> reads it and renders one card per
--      enabled item. Default seeds match the Algerian context
--      (Yalidine / COD / WhatsApp / 7-day warranty / social proof).
--
--   2. mobile_empty_states (new) — one row per screen_key. Drives
--      the <SmartEmptyState screen="…"/> component used in cart,
--      wishlist, orders and search empty states. Admin can swap
--      titles, CTAs, and toggle per-screen smart features
--      (recently_viewed / trending / recommendations / referral CTA)
--      without a release.

-- ─── 1. Trust signals on mobile_cart_settings ───────────────────────────
ALTER TABLE public.mobile_cart_settings
  ADD COLUMN IF NOT EXISTS trust_signals JSONB NOT NULL DEFAULT '[
    {"key":"shipping","enabled":true,"icon":"rocket-outline",
     "label_fr":"Livraison Yalidine / ZR Express","label_ar":"التوصيل عبر ياليدين / ZR"},
    {"key":"cod","enabled":true,"icon":"cash-outline",
     "label_fr":"Paiement à la livraison","label_ar":"الدفع عند الاستلام"},
    {"key":"whatsapp","enabled":true,"icon":"logo-whatsapp",
     "label_fr":"Support WhatsApp 24/7","label_ar":"دعم واتساب 24/7"},
    {"key":"warranty","enabled":true,"icon":"shield-checkmark-outline",
     "label_fr":"Garantie 7 jours","label_ar":"ضمان 7 أيام"},
    {"key":"social","enabled":true,"icon":"people-outline",
     "label_fr":"+10 000 clients satisfaits","label_ar":"+10000 عميل راضٍ"}
  ]'::jsonb;

-- Backfill existing row(s) so screens hit defaults immediately.
UPDATE public.mobile_cart_settings
   SET trust_signals = '[
     {"key":"shipping","enabled":true,"icon":"rocket-outline","label_fr":"Livraison Yalidine / ZR Express","label_ar":"التوصيل عبر ياليدين / ZR"},
     {"key":"cod","enabled":true,"icon":"cash-outline","label_fr":"Paiement à la livraison","label_ar":"الدفع عند الاستلام"},
     {"key":"whatsapp","enabled":true,"icon":"logo-whatsapp","label_fr":"Support WhatsApp 24/7","label_ar":"دعم واتساب 24/7"},
     {"key":"warranty","enabled":true,"icon":"shield-checkmark-outline","label_fr":"Garantie 7 jours","label_ar":"ضمان 7 أيام"},
     {"key":"social","enabled":true,"icon":"people-outline","label_fr":"+10 000 clients satisfaits","label_ar":"+10000 عميل راضٍ"}
   ]'::jsonb
 WHERE trust_signals = '[]'::jsonb OR trust_signals IS NULL;

COMMENT ON COLUMN public.mobile_cart_settings.trust_signals IS
  'Per-row trust badges shown on the empty cart and checkout. Each item: {key, icon, label_fr, label_ar, enabled}. Order is preserved from the JSONB array.';


-- ─── 2. mobile_empty_states ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mobile_empty_states (
  screen_key TEXT PRIMARY KEY,
  illustration_url TEXT,

  title_fr TEXT, title_ar TEXT,
  subtitle_fr TEXT, subtitle_ar TEXT,

  cta_primary_label_fr TEXT, cta_primary_label_ar TEXT, cta_primary_link TEXT,
  cta_secondary_label_fr TEXT, cta_secondary_label_ar TEXT, cta_secondary_link TEXT,

  -- Toggles for the smart-empty-state surfaces (mobile decides what
  -- each toggle means; admin just hides/shows the surface).
  show_recently_viewed BOOLEAN NOT NULL DEFAULT TRUE,
  show_trending BOOLEAN NOT NULL DEFAULT TRUE,
  show_recommendations BOOLEAN NOT NULL DEFAULT TRUE,
  show_referral_cta BOOLEAN NOT NULL DEFAULT FALSE,

  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.mobile_empty_states IS
  'Per-screen empty-state copy + smart-surface toggles. Anon SELECT for the mobile app; service-role writes via admin-mobile-config.';

ALTER TABLE public.mobile_empty_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS empty_states_anon_read   ON public.mobile_empty_states;
DROP POLICY IF EXISTS empty_states_authed_read ON public.mobile_empty_states;
CREATE POLICY empty_states_anon_read   ON public.mobile_empty_states FOR SELECT TO anon          USING (true);
CREATE POLICY empty_states_authed_read ON public.mobile_empty_states FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public._mobile_empty_states_touch()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS mobile_empty_states_touch ON public.mobile_empty_states;
CREATE TRIGGER mobile_empty_states_touch
  BEFORE UPDATE ON public.mobile_empty_states
  FOR EACH ROW EXECUTE FUNCTION public._mobile_empty_states_touch();


-- ─── Realtime ───────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='mobile_empty_states'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mobile_empty_states;
  END IF;
END
$$;
ALTER TABLE public.mobile_empty_states REPLICA IDENTITY FULL;


-- ─── Seed: 4 starter empty states ────────────────────────────────────────
INSERT INTO public.mobile_empty_states (
  screen_key, title_fr, title_ar, subtitle_fr, subtitle_ar,
  cta_primary_label_fr, cta_primary_label_ar, cta_primary_link,
  cta_secondary_label_fr, cta_secondary_label_ar, cta_secondary_link,
  show_recently_viewed, show_trending, show_recommendations
) VALUES
  ('cart',
   'Pas encore d''articles ?', 'لا توجد منتجات بعد ؟',
   'Continuez votre shopping pour préparer la rentrée.', 'تابع التسوق لتحضير الدخول المدرسي.',
   'Parcourir les articles', 'تصفح المنتجات', '/(tabs)/explore',
   'Voir les offres', 'شاهد العروض', '/(tabs)/explore?theme=economies',
   TRUE, TRUE, TRUE),

  ('orders',
   'Aucune commande pour l''instant', 'لا توجد طلبات بعد',
   'Votre première commande s''affichera ici.', 'سيظهر طلبك الأول هنا.',
   'Découvrir le catalogue', 'استكشف الكتالوج', '/(tabs)/explore',
   NULL, NULL, NULL,
   TRUE, TRUE, TRUE),

  ('wishlist',
   'Liste de favoris vide', 'قائمة المفضلة فارغة',
   'Ajoutez des produits à vos favoris pour les retrouver ici.', 'أضف منتجات لعرضها لاحقاً.',
   'Parcourir les articles', 'تصفح المنتجات', '/(tabs)/explore',
   NULL, NULL, NULL,
   TRUE, TRUE, FALSE),

  ('search',
   'Aucun résultat', 'لا توجد نتائج',
   'Essayez un autre mot-clé ou parcourez nos catégories.', 'جرّب كلمة أخرى أو تصفح الفئات.',
   'Voir les nouveautés', 'عرض الجديد', '/(tabs)/explore',
   NULL, NULL, NULL,
   FALSE, TRUE, TRUE)
ON CONFLICT (screen_key) DO NOTHING;

-- Trigger function should not be RPC-callable.
REVOKE EXECUTE ON FUNCTION public._mobile_empty_states_touch() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._mobile_empty_states_touch() FROM anon;
REVOKE EXECUTE ON FUNCTION public._mobile_empty_states_touch() FROM authenticated;
