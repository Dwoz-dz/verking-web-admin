-- Phase 9 — Mode Étudiant + Packs Classe
--
-- Three tables anchored on the Algerian school system (Primaire 1AP→5AP,
-- Moyen 1AM→4AM, Secondaire 1AS→3AS = 12 levels):
--
--   ▸ mobile_school_levels         catalog of all 12 levels
--   ▸ mobile_class_packs           bundled product collections per level
--   ▸ mobile_user_school_profile   per-device student profile
--
-- Two SECURITY DEFINER RPC scope per-device profile reads/writes:
--   school_save_my_profile · school_get_my_profile
--
-- Seeds the 12 canonical levels + 3 vitrine packs (Rentrée Primaire /
-- Moyen / Secondaire). Idempotent — safe to re-run.

-- ─── 1. School levels catalog ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mobile_school_levels (
  level_key TEXT PRIMARY KEY CHECK (level_key ~ '^[a-z0-9_]+$' AND length(level_key) BETWEEN 1 AND 16),
  cycle TEXT NOT NULL CHECK (cycle IN ('primaire', 'moyen', 'secondaire')),
  name_fr TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  short_label_fr TEXT NOT NULL,
  short_label_ar TEXT NOT NULL,
  age_min INTEGER CHECK (age_min IS NULL OR age_min BETWEEN 5 AND 25),
  age_max INTEGER CHECK (age_max IS NULL OR age_max BETWEEN 5 AND 25),
  emoji TEXT,
  accent_color TEXT NOT NULL DEFAULT '#2D7DD2',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mobile_school_levels_cycle_idx
  ON public.mobile_school_levels (cycle, sort_order);

ALTER TABLE public.mobile_school_levels REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='mobile_school_levels') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.mobile_school_levels';
  END IF;
END $$;

ALTER TABLE public.mobile_school_levels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon read active levels" ON public.mobile_school_levels;
CREATE POLICY "anon read active levels" ON public.mobile_school_levels
  FOR SELECT TO anon, authenticated USING (is_active = TRUE);

INSERT INTO public.mobile_school_levels
  (level_key, cycle, name_fr, name_ar, short_label_fr, short_label_ar, age_min, age_max, emoji, accent_color, sort_order)
VALUES
  -- Primaire (5 levels) — orange family
  ('1ap','primaire','1ère année primaire','السنة الأولى ابتدائي','1AP','1 ابتدائي', 6, 7,'📚','#FF7A1A',101),
  ('2ap','primaire','2ème année primaire','السنة الثانية ابتدائي','2AP','2 ابتدائي', 7, 8,'✏️','#FF7A1A',102),
  ('3ap','primaire','3ème année primaire','السنة الثالثة ابتدائي','3AP','3 ابتدائي', 8, 9,'🎒','#E85D6B',103),
  ('4ap','primaire','4ème année primaire','السنة الرابعة ابتدائي','4AP','4 ابتدائي', 9,10,'📐','#E85D6B',104),
  ('5ap','primaire','5ème année primaire','السنة الخامسة ابتدائي','5AP','5 ابتدائي',10,11,'🌟','#E25D00',105),
  -- Moyen (4 levels) — mint / fresh family
  ('1am','moyen','1ère année moyenne','السنة الأولى متوسط','1AM','1 متوسط',11,12,'🧮','#43D9DB',201),
  ('2am','moyen','2ème année moyenne','السنة الثانية متوسط','2AM','2 متوسط',12,13,'🔬','#43D9DB',202),
  ('3am','moyen','3ème année moyenne','السنة الثالثة متوسط','3AM','3 متوسط',13,14,'🌍','#4CAF80',203),
  ('4am','moyen','4ème année moyenne (BEM)','السنة الرابعة متوسط (BEM)','4AM','4 متوسط',14,15,'🎓','#4CAF80',204),
  -- Secondaire (3 levels) — lavender / sunshine family
  ('1as','secondaire','1ère année secondaire','السنة الأولى ثانوي','1AS','1 ثانوي',15,16,'💡','#7C5DDB',301),
  ('2as','secondaire','2ème année secondaire','السنة الثانية ثانوي','2AS','2 ثانوي',16,17,'📖','#7C5DDB',302),
  ('3as','secondaire','3ème année secondaire (BAC)','السنة الثالثة ثانوي (BAC)','3AS','3 ثانوي',17,18,'🏆','#FFC93C',303)
ON CONFLICT (level_key) DO NOTHING;

-- ─── 2. Class packs ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mobile_class_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$'),
  title_fr TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  subtitle_fr TEXT,
  subtitle_ar TEXT,
  description_fr TEXT,
  description_ar TEXT,
  cycle TEXT CHECK (cycle IS NULL OR cycle IN ('primaire','moyen','secondaire','all')),
  level_keys TEXT[] NOT NULL DEFAULT '{}',
  cover_image_url TEXT,
  badge_emoji TEXT,
  accent_color TEXT NOT NULL DEFAULT '#FF7A1A',
  product_ids UUID[] NOT NULL DEFAULT '{}',
  bundle_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0
    CHECK (bundle_discount_percent >= 0 AND bundle_discount_percent <= 100),
  bonus_coupon_id UUID REFERENCES public.mobile_coupons(id) ON DELETE SET NULL,
  stock INTEGER CHECK (stock IS NULL OR stock >= 0),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  target_wilayas TEXT[] DEFAULT NULL,
  display_priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mobile_class_packs_active_idx
  ON public.mobile_class_packs (is_active, display_priority DESC);
CREATE INDEX IF NOT EXISTS mobile_class_packs_window_idx
  ON public.mobile_class_packs (starts_at, ends_at);
CREATE INDEX IF NOT EXISTS mobile_class_packs_cycle_idx
  ON public.mobile_class_packs (cycle) WHERE cycle IS NOT NULL;
CREATE INDEX IF NOT EXISTS mobile_class_packs_levels_idx
  ON public.mobile_class_packs USING GIN (level_keys);
CREATE INDEX IF NOT EXISTS mobile_class_packs_coupon_idx
  ON public.mobile_class_packs (bonus_coupon_id) WHERE bonus_coupon_id IS NOT NULL;

ALTER TABLE public.mobile_class_packs REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='mobile_class_packs') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.mobile_class_packs';
  END IF;
END $$;

ALTER TABLE public.mobile_class_packs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon read active packs" ON public.mobile_class_packs;
CREATE POLICY "anon read active packs" ON public.mobile_class_packs
  FOR SELECT TO anon, authenticated USING (
    is_active = TRUE
    AND (starts_at IS NULL OR starts_at <= NOW())
    AND (ends_at IS NULL OR ends_at > NOW())
  );

-- Vitrine packs — minimal seed so /packs has something to show on first launch.
INSERT INTO public.mobile_class_packs
  (slug, title_fr, title_ar, subtitle_fr, subtitle_ar, description_fr, description_ar,
   cycle, level_keys, badge_emoji, accent_color, bundle_discount_percent, is_featured, sort_order, display_priority)
VALUES
  ('rentree-primaire',
   'Pack Rentrée Primaire', 'حقيبة الدخول المدرسي - الابتدائي',
   'Tout ce qu''il faut pour bien démarrer', 'كل ما يحتاجه طفلك لبداية موفقة',
   'Cahiers, stylos, gomme, règle, taille-crayon — la liste officielle des fournitures pour le cycle primaire en un seul clic.',
   'دفاتر، أقلام، ممحاة، مسطرة، براية - قائمة الأدوات الرسمية للمرحلة الابتدائية في نقرة واحدة.',
   'primaire', ARRAY['1ap','2ap','3ap','4ap','5ap'],
   '🎒', '#FF7A1A', 5.00, TRUE, 1, 100),
  ('rentree-moyen',
   'Pack Rentrée Moyen', 'حقيبة الدخول المدرسي - المتوسط',
   'Préparez le BEM en toute sérénité', 'استعد لشهادة التعليم المتوسط بثقة',
   'Cahiers grand format, calculatrice, géométrie, classeurs et plus — le pack complet pour les 4 années du collège.',
   'دفاتر بالحجم الكبير، حاسبة، أدوات هندسية، مصنفات والمزيد - حزمة كاملة لسنوات المتوسط.',
   'moyen', ARRAY['1am','2am','3am','4am'],
   '📐', '#43D9DB', 8.00, TRUE, 2, 90),
  ('rentree-secondaire',
   'Pack Rentrée Secondaire', 'حقيبة الدخول المدرسي - الثانوي',
   'Cap sur le BAC', 'في الطريق إلى البكالوريا',
   'Cahiers spirales, stylos premium, calculatrice scientifique, agenda et chemises — tout pour le cycle secondaire.',
   'دفاتر سلكية، أقلام بريميوم، حاسبة علمية، أجندة وملفات - كل شيء للمرحلة الثانوية.',
   'secondaire', ARRAY['1as','2as','3as'],
   '🎓', '#7C5DDB', 10.00, TRUE, 3, 80)
ON CONFLICT (slug) DO NOTHING;

-- ─── 3. Per-device school profile ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mobile_user_school_profile (
  device_id TEXT PRIMARY KEY CHECK (length(device_id) BETWEEN 4 AND 128),
  user_id UUID,
  level_key TEXT REFERENCES public.mobile_school_levels(level_key) ON DELETE SET NULL,
  cycle TEXT,
  student_name TEXT,
  parent_name TEXT,
  school_name TEXT,
  relationship TEXT CHECK (relationship IS NULL OR relationship IN ('self','parent','sibling','other')),
  preferred_lang TEXT CHECK (preferred_lang IS NULL OR preferred_lang IN ('fr','ar','en')),
  set_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mobile_user_school_profile_user_idx
  ON public.mobile_user_school_profile (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS mobile_user_school_profile_level_idx
  ON public.mobile_user_school_profile (level_key) WHERE level_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS mobile_user_school_profile_cycle_idx
  ON public.mobile_user_school_profile (cycle) WHERE cycle IS NOT NULL;

ALTER TABLE public.mobile_user_school_profile REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='mobile_user_school_profile') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.mobile_user_school_profile';
  END IF;
END $$;

ALTER TABLE public.mobile_user_school_profile ENABLE ROW LEVEL SECURITY;
-- Anon SELECT not allowed: profile reads go through the SECURITY DEFINER
-- RPC so a device only ever sees its own row. Service role retains full
-- access for admin and analytics queries.

-- ─── Touch trigger ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._mobile_school_touch()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END $$;

REVOKE EXECUTE ON FUNCTION public._mobile_school_touch() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._mobile_school_touch() FROM anon;
REVOKE EXECUTE ON FUNCTION public._mobile_school_touch() FROM authenticated;

DO $$ DECLARE t TEXT; BEGIN
  FOR t IN SELECT unnest(ARRAY['mobile_school_levels','mobile_class_packs','mobile_user_school_profile']) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I; CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public._mobile_school_touch();',
      t || '_touch', t, t || '_touch', t);
  END LOOP;
END $$;

-- ─── RPC: save_my_profile ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.school_save_my_profile(
  p_device_id TEXT,
  p_level_key TEXT,
  p_student_name TEXT DEFAULT NULL,
  p_parent_name TEXT DEFAULT NULL,
  p_school_name TEXT DEFAULT NULL,
  p_relationship TEXT DEFAULT NULL,
  p_preferred_lang TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cycle TEXT;
BEGIN
  IF p_device_id IS NULL OR length(trim(p_device_id)) < 4 THEN
    RAISE EXCEPTION 'invalid device id';
  END IF;
  IF p_level_key IS NULL OR p_level_key = '' THEN
    RAISE EXCEPTION 'level_key is required';
  END IF;

  -- Resolve cycle from the canonical level
  SELECT cycle INTO v_cycle FROM public.mobile_school_levels
   WHERE level_key = p_level_key AND is_active = TRUE;
  IF v_cycle IS NULL THEN
    RAISE EXCEPTION 'unknown or inactive level';
  END IF;

  IF p_relationship IS NOT NULL AND p_relationship NOT IN ('self','parent','sibling','other') THEN
    RAISE EXCEPTION 'invalid relationship';
  END IF;
  IF p_preferred_lang IS NOT NULL AND p_preferred_lang NOT IN ('fr','ar','en') THEN
    RAISE EXCEPTION 'invalid preferred_lang';
  END IF;

  INSERT INTO public.mobile_user_school_profile
    (device_id, level_key, cycle, student_name, parent_name, school_name, relationship, preferred_lang, set_at)
  VALUES
    (p_device_id, p_level_key, v_cycle,
     NULLIF(trim(coalesce(p_student_name,'')),''),
     NULLIF(trim(coalesce(p_parent_name,'')),''),
     NULLIF(trim(coalesce(p_school_name,'')),''),
     p_relationship, p_preferred_lang, NOW())
  ON CONFLICT (device_id) DO UPDATE SET
    level_key      = EXCLUDED.level_key,
    cycle          = EXCLUDED.cycle,
    student_name   = COALESCE(EXCLUDED.student_name,   public.mobile_user_school_profile.student_name),
    parent_name    = COALESCE(EXCLUDED.parent_name,    public.mobile_user_school_profile.parent_name),
    school_name    = COALESCE(EXCLUDED.school_name,    public.mobile_user_school_profile.school_name),
    relationship   = COALESCE(EXCLUDED.relationship,   public.mobile_user_school_profile.relationship),
    preferred_lang = COALESCE(EXCLUDED.preferred_lang, public.mobile_user_school_profile.preferred_lang),
    set_at         = NOW();

  RETURN jsonb_build_object(
    'device_id', p_device_id,
    'level_key', p_level_key,
    'cycle', v_cycle
  );
END $$;

GRANT EXECUTE ON FUNCTION public.school_save_my_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- ─── RPC: get_my_profile ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.school_get_my_profile(p_device_id TEXT)
RETURNS public.mobile_user_school_profile
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.mobile_user_school_profile WHERE device_id = p_device_id LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.school_get_my_profile(TEXT) TO anon, authenticated;

-- ─── RPC: clear_my_profile ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.school_clear_my_profile(p_device_id TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_device_id IS NULL OR length(trim(p_device_id)) < 4 THEN
    RAISE EXCEPTION 'invalid device id';
  END IF;
  DELETE FROM public.mobile_user_school_profile WHERE device_id = p_device_id;
  RETURN TRUE;
END $$;

GRANT EXECUTE ON FUNCTION public.school_clear_my_profile(TEXT) TO anon, authenticated;
