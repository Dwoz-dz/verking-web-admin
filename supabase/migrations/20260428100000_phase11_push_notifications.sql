-- Phase 11 — Push Notifications
--
-- Five tables forming the Expo Push pipeline:
--
--   ▸ mobile_push_devices       per-device Expo token registry
--   ▸ mobile_push_topics        admin-curated subscription topics
--   ▸ mobile_user_push_topics   per-device opt-in/opt-out
--   ▸ mobile_push_campaigns     admin-defined broadcasts
--   ▸ mobile_push_log           append-only delivery log + receipts
--
-- Six SECURITY DEFINER RPCs scope per-device profile reads/writes.
-- Idempotent — safe to re-run.

-- ─── 1. Push devices ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mobile_push_devices (
  device_id TEXT PRIMARY KEY CHECK (length(device_id) BETWEEN 4 AND 128),
  user_id UUID,
  expo_token TEXT NOT NULL CHECK (expo_token ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{16,}\]$'),
  platform TEXT CHECK (platform IS NULL OR platform IN ('ios', 'android', 'web')),
  app_version TEXT,
  locale TEXT CHECK (locale IS NULL OR locale IN ('fr', 'ar', 'en')),
  timezone TEXT,
  wilaya_code TEXT,
  level_key TEXT REFERENCES public.mobile_school_levels(level_key) ON DELETE SET NULL,
  cycle TEXT CHECK (cycle IS NULL OR cycle IN ('primaire', 'moyen', 'secondaire')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  failure_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mobile_push_devices_token_idx
  ON public.mobile_push_devices (expo_token) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS mobile_push_devices_wilaya_idx
  ON public.mobile_push_devices (wilaya_code) WHERE is_active = TRUE AND wilaya_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS mobile_push_devices_level_idx
  ON public.mobile_push_devices (level_key) WHERE level_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS mobile_push_devices_user_idx
  ON public.mobile_push_devices (user_id) WHERE user_id IS NOT NULL;

ALTER TABLE public.mobile_push_devices REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='mobile_push_devices') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.mobile_push_devices';
  END IF;
END $$;

ALTER TABLE public.mobile_push_devices ENABLE ROW LEVEL SECURITY;
-- No anon SELECT: register/unregister via SECURITY DEFINER RPC only.

-- ─── 2. Push topics (admin) ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mobile_push_topics (
  topic_key TEXT PRIMARY KEY
    CHECK (topic_key ~ '^[a-z][a-z0-9_]*$' AND length(topic_key) BETWEEN 1 AND 32),
  label_fr TEXT NOT NULL,
  label_ar TEXT NOT NULL,
  description_fr TEXT,
  description_ar TEXT,
  emoji TEXT,
  icon TEXT,
  accent_color TEXT NOT NULL DEFAULT '#2D7DD2',
  default_opt_in BOOLEAN NOT NULL DEFAULT TRUE,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mobile_push_topics_active_idx
  ON public.mobile_push_topics (is_active, sort_order);

ALTER TABLE public.mobile_push_topics REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='mobile_push_topics') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.mobile_push_topics';
  END IF;
END $$;

ALTER TABLE public.mobile_push_topics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon read active topics" ON public.mobile_push_topics;
CREATE POLICY "anon read active topics" ON public.mobile_push_topics
  FOR SELECT TO anon, authenticated USING (is_active = TRUE);

INSERT INTO public.mobile_push_topics
  (topic_key, label_fr, label_ar, description_fr, description_ar, emoji, accent_color, default_opt_in, is_required, sort_order)
VALUES
  ('order_status',
   'Mises à jour de commande', 'تحديثات الطلب',
   'Statut de votre commande, livraison et confirmations.',
   'حالة طلبك، التوصيل والتأكيدات.',
   '📦', '#2D7DD2', TRUE, TRUE, 1),
  ('promotions',
   'Promotions & Coupons', 'العروض والكوبونات',
   'Bons d''achat, codes promos et offres spéciales.',
   'كوبونات، رموز ترويجية وعروض خاصة.',
   '🎁', '#FF7A1A', TRUE, FALSE, 2),
  ('flash_sales',
   'Ventes flash', 'عروض ساعات سعيدة',
   'Soyez alerté(e) des ventes flash avec compte à rebours.',
   'احصل على إشعار للعروض السريعة المؤقتة.',
   '⚡', '#FFC93C', TRUE, FALSE, 3),
  ('rentree',
   'Rentrée scolaire', 'الدخول المدرسي',
   'Packs Classe, listes de fournitures, conseils rentrée.',
   'حقائب الدخول، قوائم الأدوات، نصائح الرجوع للمدرسة.',
   '🎒', '#E85D6B', TRUE, FALSE, 4),
  ('loyalty',
   'Programme de fidélité', 'برنامج الولاء',
   'Gains de points, déblocages de niveau, défis du moment.',
   'كسب نقاط، فتح المستويات، تحديات الوقت الحالي.',
   '⭐', '#7C5DDB', TRUE, FALSE, 5),
  ('new_arrivals',
   'Nouveautés', 'الجديد',
   'Premiers à savoir quand de nouveaux produits arrivent.',
   'كن أول من يعرف عند وصول منتجات جديدة.',
   '✨', '#43D9DB', FALSE, FALSE, 6),
  ('school_packs',
   'Packs Classe', 'حزم الفصل',
   'Nouvelles collections de packs et remises de groupe.',
   'مجموعات حزم جديدة وخصومات الجماعة.',
   '📚', '#4CAF80', FALSE, FALSE, 7)
ON CONFLICT (topic_key) DO NOTHING;

-- ─── 3. User × Topic preferences ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mobile_user_push_topics (
  device_id TEXT NOT NULL CHECK (length(device_id) BETWEEN 4 AND 128),
  topic_key TEXT NOT NULL REFERENCES public.mobile_push_topics(topic_key) ON DELETE CASCADE,
  user_id UUID,
  opted_in BOOLEAN NOT NULL DEFAULT TRUE,
  source TEXT CHECK (source IS NULL OR source IN ('default','user','admin')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (device_id, topic_key)
);

CREATE INDEX IF NOT EXISTS mobile_user_push_topics_topic_idx
  ON public.mobile_user_push_topics (topic_key, opted_in);
CREATE INDEX IF NOT EXISTS mobile_user_push_topics_user_idx
  ON public.mobile_user_push_topics (user_id) WHERE user_id IS NOT NULL;

ALTER TABLE public.mobile_user_push_topics REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='mobile_user_push_topics') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.mobile_user_push_topics';
  END IF;
END $$;

ALTER TABLE public.mobile_user_push_topics ENABLE ROW LEVEL SECURITY;
-- Device-scoped via SECURITY DEFINER RPCs only.

-- ─── 4. Push campaigns ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mobile_push_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$'),
  title_fr TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  body_fr TEXT NOT NULL,
  body_ar TEXT NOT NULL,
  image_url TEXT,
  deep_link TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  target_topics TEXT[] NOT NULL DEFAULT '{}',
  target_wilayas TEXT[],
  target_levels TEXT[],
  target_segment TEXT CHECK (target_segment IS NULL OR target_segment IN ('all','student','parent','wholesale')),
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  sent_count INTEGER NOT NULL DEFAULT 0 CHECK (sent_count >= 0),
  delivered_count INTEGER NOT NULL DEFAULT 0 CHECK (delivered_count >= 0),
  failed_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sending','sent','failed','cancelled')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mobile_push_campaigns_status_idx
  ON public.mobile_push_campaigns (status, created_at DESC);
CREATE INDEX IF NOT EXISTS mobile_push_campaigns_scheduled_idx
  ON public.mobile_push_campaigns (scheduled_for) WHERE scheduled_for IS NOT NULL AND status = 'scheduled';
CREATE INDEX IF NOT EXISTS mobile_push_campaigns_topics_idx
  ON public.mobile_push_campaigns USING GIN (target_topics);

ALTER TABLE public.mobile_push_campaigns REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='mobile_push_campaigns') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.mobile_push_campaigns';
  END IF;
END $$;

ALTER TABLE public.mobile_push_campaigns ENABLE ROW LEVEL SECURITY;
-- Admin-only, no anon access.

-- ─── 5. Push log (append-only, includes Expo receipts) ─────────────────

CREATE TABLE IF NOT EXISTS public.mobile_push_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.mobile_push_campaigns(id) ON DELETE SET NULL,
  device_id TEXT,
  expo_token TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued','sent','delivered','failed','expired')),
  expo_ticket_id TEXT,
  expo_receipt_id TEXT,
  error_code TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  UNIQUE (campaign_id, device_id)
);

CREATE INDEX IF NOT EXISTS mobile_push_log_campaign_idx
  ON public.mobile_push_log (campaign_id, sent_at DESC) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS mobile_push_log_device_idx
  ON public.mobile_push_log (device_id, sent_at DESC) WHERE device_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS mobile_push_log_status_idx
  ON public.mobile_push_log (status, sent_at DESC);

ALTER TABLE public.mobile_push_log ENABLE ROW LEVEL SECURITY;
-- Admin-only via service role; no anon access to delivery logs.

-- ─── Touch trigger ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._mobile_push_touch()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END $$;
REVOKE EXECUTE ON FUNCTION public._mobile_push_touch() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._mobile_push_touch() FROM anon;
REVOKE EXECUTE ON FUNCTION public._mobile_push_touch() FROM authenticated;

DO $$ DECLARE t TEXT; BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'mobile_push_devices','mobile_push_topics',
    'mobile_user_push_topics','mobile_push_campaigns'])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS %I ON public.%I; CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public._mobile_push_touch();',
      t || '_touch', t, t || '_touch', t);
  END LOOP;
END $$;

-- ─── RPC: register_device ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.push_register_device(
  p_device_id TEXT,
  p_expo_token TEXT,
  p_platform TEXT DEFAULT NULL,
  p_app_version TEXT DEFAULT NULL,
  p_locale TEXT DEFAULT NULL,
  p_timezone TEXT DEFAULT NULL,
  p_wilaya_code TEXT DEFAULT NULL,
  p_level_key TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_was_new BOOLEAN := FALSE;
  v_cycle TEXT;
BEGIN
  IF p_device_id IS NULL OR length(trim(p_device_id)) < 4 THEN
    RAISE EXCEPTION 'invalid device id';
  END IF;
  IF p_expo_token !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{16,}\]$' THEN
    RAISE EXCEPTION 'invalid expo token';
  END IF;

  -- Resolve cycle from level if provided
  IF p_level_key IS NOT NULL THEN
    SELECT cycle INTO v_cycle FROM public.mobile_school_levels WHERE level_key = p_level_key;
  END IF;

  -- Detect first-time registration BEFORE the upsert
  IF NOT EXISTS (SELECT 1 FROM public.mobile_push_devices WHERE device_id = p_device_id) THEN
    v_was_new := TRUE;
  END IF;

  INSERT INTO public.mobile_push_devices
    (device_id, expo_token, platform, app_version, locale, timezone, wilaya_code, level_key, cycle, is_active, last_seen_at, failure_count)
  VALUES
    (p_device_id, p_expo_token, p_platform, p_app_version, p_locale, p_timezone, p_wilaya_code, p_level_key, v_cycle, TRUE, NOW(), 0)
  ON CONFLICT (device_id) DO UPDATE SET
    expo_token   = EXCLUDED.expo_token,
    platform     = COALESCE(EXCLUDED.platform,     public.mobile_push_devices.platform),
    app_version  = COALESCE(EXCLUDED.app_version,  public.mobile_push_devices.app_version),
    locale       = COALESCE(EXCLUDED.locale,       public.mobile_push_devices.locale),
    timezone     = COALESCE(EXCLUDED.timezone,     public.mobile_push_devices.timezone),
    wilaya_code  = COALESCE(EXCLUDED.wilaya_code,  public.mobile_push_devices.wilaya_code),
    level_key    = COALESCE(EXCLUDED.level_key,    public.mobile_push_devices.level_key),
    cycle        = COALESCE(EXCLUDED.cycle,        public.mobile_push_devices.cycle),
    is_active    = TRUE,
    last_seen_at = NOW(),
    failure_count = 0;

  -- Seed default opt-in preferences for any topic the device hasn't seen yet.
  INSERT INTO public.mobile_user_push_topics (device_id, topic_key, opted_in, source)
  SELECT p_device_id, t.topic_key, t.default_opt_in, 'default'
    FROM public.mobile_push_topics t
   WHERE t.is_active = TRUE
  ON CONFLICT (device_id, topic_key) DO NOTHING;

  RETURN jsonb_build_object(
    'device_id', p_device_id,
    'is_new', v_was_new,
    'topics_count', (SELECT count(*) FROM public.mobile_user_push_topics WHERE device_id = p_device_id)
  );
END $$;

GRANT EXECUTE ON FUNCTION public.push_register_device(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- ─── RPC: unregister_device ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.push_unregister_device(p_device_id TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_device_id IS NULL OR length(trim(p_device_id)) < 4 THEN RAISE EXCEPTION 'invalid device id'; END IF;
  UPDATE public.mobile_push_devices SET is_active = FALSE, updated_at = NOW() WHERE device_id = p_device_id;
  RETURN TRUE;
END $$;

GRANT EXECUTE ON FUNCTION public.push_unregister_device(TEXT) TO anon, authenticated;

-- ─── RPC: set_topic ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.push_set_topic(
  p_device_id TEXT,
  p_topic_key TEXT,
  p_opted_in BOOLEAN
) RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_required BOOLEAN;
BEGIN
  IF p_device_id IS NULL OR length(trim(p_device_id)) < 4 THEN RAISE EXCEPTION 'invalid device id'; END IF;
  -- Required topics cannot be opted out (e.g. order_status).
  SELECT is_required INTO v_required FROM public.mobile_push_topics
    WHERE topic_key = p_topic_key AND is_active = TRUE;
  IF v_required IS NULL THEN RAISE EXCEPTION 'unknown or inactive topic'; END IF;
  IF v_required = TRUE AND p_opted_in = FALSE THEN
    RAISE EXCEPTION 'this topic is required and cannot be opted out';
  END IF;

  INSERT INTO public.mobile_user_push_topics (device_id, topic_key, opted_in, source)
  VALUES (p_device_id, p_topic_key, p_opted_in, 'user')
  ON CONFLICT (device_id, topic_key) DO UPDATE SET
    opted_in = EXCLUDED.opted_in,
    source = 'user',
    updated_at = NOW();

  RETURN jsonb_build_object(
    'topic_key', p_topic_key,
    'opted_in', p_opted_in
  );
END $$;

GRANT EXECUTE ON FUNCTION public.push_set_topic(TEXT, TEXT, BOOLEAN) TO anon, authenticated;

-- ─── RPC: get_my_topics ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.push_get_my_topics(p_device_id TEXT)
RETURNS TABLE (
  topic_key TEXT,
  label_fr TEXT,
  label_ar TEXT,
  description_fr TEXT,
  description_ar TEXT,
  emoji TEXT,
  accent_color TEXT,
  is_required BOOLEAN,
  opted_in BOOLEAN,
  sort_order INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    t.topic_key, t.label_fr, t.label_ar, t.description_fr, t.description_ar,
    t.emoji, t.accent_color, t.is_required,
    COALESCE(u.opted_in, t.default_opt_in) AS opted_in,
    t.sort_order
  FROM public.mobile_push_topics t
  LEFT JOIN public.mobile_user_push_topics u
    ON u.topic_key = t.topic_key AND u.device_id = p_device_id
  WHERE t.is_active = TRUE
  ORDER BY t.sort_order, t.topic_key
$$;

GRANT EXECUTE ON FUNCTION public.push_get_my_topics(TEXT) TO anon, authenticated;

-- ─── RPC: count_my_topics (badge) ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.push_count_my_topics(p_device_id TEXT)
RETURNS INTEGER LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::INTEGER
    FROM public.mobile_push_topics t
    LEFT JOIN public.mobile_user_push_topics u
      ON u.topic_key = t.topic_key AND u.device_id = p_device_id
   WHERE t.is_active = TRUE
     AND COALESCE(u.opted_in, t.default_opt_in) = TRUE
$$;

GRANT EXECUTE ON FUNCTION public.push_count_my_topics(TEXT) TO anon, authenticated;

-- ─── RPC: resolve_recipients (admin/service-role only) ────────────────
-- Returns the active expo tokens that match a campaign's targeting.
-- Useful for the admin to preview the audience before clicking "Send".
-- Reachable through service_role via the edge function only (REVOKE anon).

CREATE OR REPLACE FUNCTION public.push_resolve_recipients(p_campaign_id UUID)
RETURNS TABLE (device_id TEXT, expo_token TEXT, locale TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH c AS (
    SELECT * FROM public.mobile_push_campaigns WHERE id = p_campaign_id
  )
  SELECT DISTINCT d.device_id, d.expo_token, d.locale
    FROM public.mobile_push_devices d
    JOIN public.mobile_user_push_topics u
      ON u.device_id = d.device_id AND u.opted_in = TRUE
   WHERE d.is_active = TRUE
     AND d.failure_count < 5
     AND u.topic_key = ANY((SELECT target_topics FROM c))
     AND (
       (SELECT target_wilayas FROM c) IS NULL
       OR cardinality((SELECT target_wilayas FROM c)) = 0
       OR d.wilaya_code = ANY((SELECT target_wilayas FROM c))
     )
     AND (
       (SELECT target_levels FROM c) IS NULL
       OR cardinality((SELECT target_levels FROM c)) = 0
       OR d.level_key = ANY((SELECT target_levels FROM c))
     )
$$;

REVOKE EXECUTE ON FUNCTION public.push_resolve_recipients(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.push_resolve_recipients(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.push_resolve_recipients(UUID) FROM authenticated;
-- Service role retains EXECUTE by default.
