-- Phase 2 — Profile, Settings, Addresses, Settings Schema.
--
-- Three tables:
--   1. mobile_settings_schema    — admin-controlled visibility for the
--                                  5 Settings groups (and items inside
--                                  each group).
--   2. user_preferences          — per-user prefs (language, dark mode,
--                                  notification toggles, school levels
--                                  placeholder for Phase 9).
--   3. user_addresses            — multi-address book per user.
--
-- Auth note: the `user_id` columns reference auth.users(id) and are
-- NULLABLE so we can write rows from a logged-out client today (using
-- a `device_id` field instead). When Phase 2A lands, we'll add a NOT
-- NULL constraint and migrate the device_id rows up.

-- ─── 1. mobile_settings_schema ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mobile_settings_schema (
  group_key TEXT PRIMARY KEY,
  group_label_fr TEXT NOT NULL,
  group_label_ar TEXT NOT NULL,
  group_label_en TEXT,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  -- items: ordered array of { key, label_fr, label_ar, label_en?, icon?, type, is_visible }
  -- type ∈ 'link' | 'toggle' | 'value' | 'separator'
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.mobile_settings_schema IS
  'Admin-controlled visibility of the 5 Settings groups in the mobile app. Hide/show items without a code release.';

ALTER TABLE public.mobile_settings_schema ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS settings_schema_anon_read   ON public.mobile_settings_schema;
DROP POLICY IF EXISTS settings_schema_authed_read ON public.mobile_settings_schema;
CREATE POLICY settings_schema_anon_read   ON public.mobile_settings_schema FOR SELECT TO anon          USING (true);
CREATE POLICY settings_schema_authed_read ON public.mobile_settings_schema FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public._mobile_settings_schema_touch()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS mobile_settings_schema_touch ON public.mobile_settings_schema;
CREATE TRIGGER mobile_settings_schema_touch
  BEFORE UPDATE ON public.mobile_settings_schema
  FOR EACH ROW EXECUTE FUNCTION public._mobile_settings_schema_touch();

-- Seed: 5 groups inspired by the AliExpress Settings layout, each with
-- the items already mapped onto our mobile screens. Admins can hide
-- individual items via the items[].is_visible flag.
INSERT INTO public.mobile_settings_schema (group_key, group_label_fr, group_label_ar, group_label_en, sort_order, items) VALUES
  ('account',       'Compte',        'الحساب',          'Account',         1,
    '[
      {"key":"profile",            "type":"link",  "icon":"person",          "label_fr":"Profil",                       "label_ar":"الملف الشخصي",     "label_en":"Profile",         "is_visible":true},
      {"key":"addresses",          "type":"link",  "icon":"location",        "label_fr":"Mes adresses",                 "label_ar":"عناويني",          "label_en":"My addresses",    "is_visible":true},
      {"key":"school_preferences", "type":"link",  "icon":"school",          "label_fr":"Préférences scolaires",        "label_ar":"تفضيلات المدرسة",  "label_en":"School prefs",    "is_visible":false}
    ]'::jsonb),
  ('localization',  'Localisation',  'الموقع واللغة',   'Localization',    2,
    '[
      {"key":"wilaya",   "type":"value",  "icon":"map",       "label_fr":"Wilaya de livraison",  "label_ar":"ولاية التوصيل", "label_en":"Delivery wilaya", "is_visible":true},
      {"key":"currency", "type":"value",  "icon":"cash",      "label_fr":"Devise",               "label_ar":"العملة",        "label_en":"Currency",        "is_visible":true},
      {"key":"language", "type":"value",  "icon":"language",  "label_fr":"Langue",               "label_ar":"اللغة",         "label_en":"Language",        "is_visible":true}
    ]'::jsonb),
  ('notifications', 'Notifications', 'الإشعارات والعرض', 'Notifications',  3,
    '[
      {"key":"general_notifications", "type":"link",   "icon":"notifications", "label_fr":"Paramètres de notifications", "label_ar":"إعدادات الإشعارات", "label_en":"Notification settings", "is_visible":true},
      {"key":"dark_mode",             "type":"value",  "icon":"moon",          "label_fr":"Mode sombre",                  "label_ar":"الوضع الداكن",       "label_en":"Dark mode",             "is_visible":true}
    ]'::jsonb),
  ('data',          'Données & Performance', 'البيانات والأداء', 'Data & Performance', 4,
    '[
      {"key":"recently_viewed",  "type":"link",   "icon":"time",          "label_fr":"Articles vus récemment", "label_ar":"عرضت مؤخراً",      "label_en":"Recently viewed", "is_visible":true},
      {"key":"clear_cache",      "type":"link",   "icon":"trash",         "label_fr":"Vider le cache",         "label_ar":"مسح الذاكرة المؤقتة","label_en":"Clear cache",     "is_visible":true},
      {"key":"data_saver",       "type":"toggle", "icon":"speedometer",   "label_fr":"Mode économie de données", "label_ar":"وضع توفير البيانات", "label_en":"Data saver mode", "is_visible":true},
      {"key":"video_preferences","type":"link",   "icon":"play",          "label_fr":"Préférences vidéo",      "label_ar":"تفضيلات الفيديو",   "label_en":"Video preferences","is_visible":true}
    ]'::jsonb),
  ('support',       'Support & À propos', 'الدعم والمعلومات', 'Support & About', 5,
    '[
      {"key":"help",         "type":"link", "icon":"help-circle",     "label_fr":"Centre d''aide",         "label_ar":"مركز المساعدة",      "label_en":"Help center",         "is_visible":true},
      {"key":"contact_wa",   "type":"link", "icon":"logo-whatsapp",   "label_fr":"Contacter via WhatsApp", "label_ar":"التواصل عبر واتساب", "label_en":"Contact via WhatsApp","is_visible":true},
      {"key":"rate_app",     "type":"link", "icon":"star",            "label_fr":"Avis sur Verking",       "label_ar":"تقييم فيركينج",      "label_en":"Rate Verking",        "is_visible":true},
      {"key":"about",        "type":"link", "icon":"information-circle","label_fr":"À propos",            "label_ar":"حول التطبيق",        "label_en":"About",               "is_visible":true},
      {"key":"privacy",      "type":"link", "icon":"shield-checkmark","label_fr":"Confidentialité",       "label_ar":"الخصوصية",           "label_en":"Privacy",             "is_visible":true},
      {"key":"terms",        "type":"link", "icon":"document-text",   "label_fr":"Conditions",             "label_ar":"الشروط",             "label_en":"Terms",               "is_visible":true}
    ]'::jsonb)
ON CONFLICT (group_key) DO NOTHING;


-- ─── 2. user_preferences ─────────────────────────────────────────────────
-- Phase 2 stores most prefs in AsyncStorage (no auth yet). The table
-- exists from day one so future writes from a logged-in client land in
-- the right shape — and so the admin can still query / aggregate later.
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID,
  device_id TEXT,
  language TEXT NOT NULL DEFAULT 'fr',                  -- 'fr','ar','en'
  dark_mode TEXT NOT NULL DEFAULT 'system',             -- 'system','on','off'
  notification_orders BOOLEAN NOT NULL DEFAULT TRUE,
  notification_promos BOOLEAN NOT NULL DEFAULT TRUE,
  notification_loyalty BOOLEAN NOT NULL DEFAULT TRUE,
  data_saver_mode BOOLEAN NOT NULL DEFAULT FALSE,
  video_autoplay TEXT NOT NULL DEFAULT 'wifi_only',     -- 'always','wifi_only','never'
  default_wilaya_code TEXT REFERENCES public.wilayas(code),
  -- Phase 9 placeholders (created now, used later when Mode Étudiant lands)
  school_levels TEXT[],
  children_count INT,
  school_year_start DATE,
  family_mode_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Either user_id (post-auth) or device_id (pre-auth) must identify
  -- the row. Enforce that here — a stray row with neither is invalid.
  CONSTRAINT user_preferences_pk_check CHECK (user_id IS NOT NULL OR device_id IS NOT NULL),
  CHECK (language IN ('fr','ar','en')),
  CHECK (dark_mode IN ('system','on','off')),
  CHECK (video_autoplay IN ('always','wifi_only','never'))
);

CREATE UNIQUE INDEX IF NOT EXISTS user_preferences_user_id_uidx
  ON public.user_preferences (user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS user_preferences_device_id_uidx
  ON public.user_preferences (device_id) WHERE device_id IS NOT NULL AND user_id IS NULL;

COMMENT ON TABLE public.user_preferences IS
  'Per-user/per-device preferences. Pre-auth rows use device_id; post-auth migration backfills user_id and clears device_id.';

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
-- For Phase 2 we keep this table service_role-only (no anon SELECT).
-- The mobile app uses AsyncStorage as the primary store; the table is
-- here for shape and admin aggregation. Phase 2A will add per-user
-- policies once auth is wired.

CREATE OR REPLACE FUNCTION public._user_preferences_touch()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS user_preferences_touch ON public.user_preferences;
CREATE TRIGGER user_preferences_touch
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public._user_preferences_touch();


-- ─── 3. user_addresses ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  device_id TEXT,
  label TEXT,                           -- 'Maison','Bureau','Chez les parents'
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  wilaya_code TEXT NOT NULL REFERENCES public.wilayas(code),
  baladiya TEXT,
  address_line TEXT NOT NULL,
  postal_code TEXT,
  delivery_type TEXT NOT NULL DEFAULT 'home',           -- 'home','desk'
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_addresses_owner_check CHECK (user_id IS NOT NULL OR device_id IS NOT NULL),
  CHECK (delivery_type IN ('home','desk'))
);

CREATE INDEX IF NOT EXISTS user_addresses_user_id_idx
  ON public.user_addresses (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS user_addresses_device_id_idx
  ON public.user_addresses (device_id) WHERE device_id IS NOT NULL;

COMMENT ON TABLE public.user_addresses IS
  'User shipping address book. Multi per user; one is_default per (user_id) or (device_id) recommended (enforced in app, not DB, so import/migration stays flexible).';

ALTER TABLE public.user_addresses ENABLE ROW LEVEL SECURITY;
-- Phase 2: service_role only (mobile uses AsyncStorage). Phase 2A adds
-- per-user policies.

CREATE OR REPLACE FUNCTION public._user_addresses_touch()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS user_addresses_touch ON public.user_addresses;
CREATE TRIGGER user_addresses_touch
  BEFORE UPDATE ON public.user_addresses
  FOR EACH ROW EXECUTE FUNCTION public._user_addresses_touch();


-- ─── Realtime publication for the schema table ─────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'mobile_settings_schema'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mobile_settings_schema;
  END IF;
END
$$;

ALTER TABLE public.mobile_settings_schema REPLICA IDENTITY FULL;
