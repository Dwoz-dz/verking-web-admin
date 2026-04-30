-- Phase 8 — Loyalty & Rewards system
--
-- Eight tables forming a single, append-only ledger-backed loyalty engine:
--
--   ▸ mobile_loyalty_settings        singleton row of global config
--   ▸ mobile_loyalty_levels          tiers (Bronze → Platine), threshold-driven
--   ▸ mobile_loyalty_challenges      time-boxed missions with rules
--   ▸ mobile_loyalty_rewards         redeemable catalogue items
--   ▸ mobile_loyalty_accounts        per-device balance + lifetime + tier cache
--   ▸ mobile_loyalty_ledger          append-only events (earn / redeem / adjust)
--   ▸ mobile_loyalty_user_challenges per-device progress on each challenge
--   ▸ mobile_loyalty_user_rewards    per-device redemption history
--
-- Four SECURITY DEFINER RPCs expose atomic operations to the mobile:
--   loyalty_get_or_create_account · loyalty_earn_for_order
--   loyalty_complete_challenge    · loyalty_redeem_reward
--
-- Idempotent — safe to re-run. RLS is anon-readable for catalogues
-- (settings, levels, challenges, rewards) and device-scoped for
-- accounts/ledger/user_*. All mutations go through the RPCs.

-- ─── 1. Settings (singleton) ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mobile_loyalty_settings (
  id TEXT PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  currency_label_fr TEXT NOT NULL DEFAULT 'Étoiles VERKING',
  currency_label_ar TEXT NOT NULL DEFAULT 'نجوم فيركينغ',
  currency_icon TEXT DEFAULT 'sparkles',
  point_value_da NUMERIC(10,2) NOT NULL DEFAULT 1.00 CHECK (point_value_da >= 0),
  earn_rate_per_da NUMERIC(10,4) NOT NULL DEFAULT 0.0100 CHECK (earn_rate_per_da >= 0),
  signup_bonus INTEGER NOT NULL DEFAULT 100 CHECK (signup_bonus >= 0),
  referral_referrer_bonus INTEGER NOT NULL DEFAULT 200 CHECK (referral_referrer_bonus >= 0),
  referral_referee_bonus INTEGER NOT NULL DEFAULT 100 CHECK (referral_referee_bonus >= 0),
  terms_text_fr TEXT,
  terms_text_ar TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.mobile_loyalty_settings REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='mobile_loyalty_settings') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.mobile_loyalty_settings';
  END IF;
END $$;

ALTER TABLE public.mobile_loyalty_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon read loyalty settings" ON public.mobile_loyalty_settings;
CREATE POLICY "anon read loyalty settings" ON public.mobile_loyalty_settings
  FOR SELECT TO anon, authenticated USING (TRUE);

INSERT INTO public.mobile_loyalty_settings (id) VALUES ('default')
ON CONFLICT (id) DO NOTHING;

-- ─── 2. Levels / tiers ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mobile_loyalty_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level_key TEXT UNIQUE NOT NULL CHECK (level_key ~ '^[a-z0-9_]+$' AND length(level_key) BETWEEN 1 AND 32),
  name_fr TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  threshold_points INTEGER NOT NULL DEFAULT 0 CHECK (threshold_points >= 0),
  badge_color TEXT NOT NULL DEFAULT '#2D7DD2',
  badge_icon TEXT,
  perks_fr TEXT[] NOT NULL DEFAULT '{}',
  perks_ar TEXT[] NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS mobile_loyalty_levels_threshold_idx
  ON public.mobile_loyalty_levels (threshold_points);

ALTER TABLE public.mobile_loyalty_levels REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='mobile_loyalty_levels') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.mobile_loyalty_levels';
  END IF;
END $$;

ALTER TABLE public.mobile_loyalty_levels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon read loyalty levels" ON public.mobile_loyalty_levels;
CREATE POLICY "anon read loyalty levels" ON public.mobile_loyalty_levels
  FOR SELECT TO anon, authenticated USING (is_active = TRUE);

INSERT INTO public.mobile_loyalty_levels (level_key, name_fr, name_ar, threshold_points, badge_color, badge_icon, perks_fr, perks_ar, sort_order) VALUES
  ('bronze',  'Bronze',  'برونزي',  0,
   '#CD7F32', 'medal-outline',
   ARRAY['Accès au programme de fidélité','Points sur chaque commande','Coupon de bienvenue'],
   ARRAY['الانضمام لبرنامج الولاء','نقاط على كل طلب','كوبون ترحيب'],
   1),
  ('argent',  'Argent',  'فضي',     500,
   '#9CA3AF', 'medal-outline',
   ARRAY['Coupon anniversaire','Notifications prioritaires sur les ventes flash','Points x1.2 sur les promos'],
   ARRAY['كوبون عيد ميلاد','إشعارات أولوية على عروض الفلاش','نقاط x1.2 على العروض'],
   2),
  ('or',      'Or',      'ذهبي',    2000,
   '#FFC93C', 'trophy-outline',
   ARRAY['Frais de livraison réduits','Bon trimestriel','Support WhatsApp prioritaire','Accès anticipé aux soldes'],
   ARRAY['تخفيض على رسوم التوصيل','بون شراء كل ثلاثة أشهر','دعم واتساب ذو أولوية','وصول مبكر للتخفيضات'],
   3),
  ('platine', 'Platine', 'بلاتيني', 5000,
   '#7C5DDB', 'diamond-outline',
   ARRAY['Livraison gratuite illimitée','Conseiller dédié','Cadeaux surprise','Invitations événements'],
   ARRAY['توصيل مجاني غير محدود','مستشار مخصص','هدايا مفاجأة','دعوات للفعاليات'],
   4)
ON CONFLICT (level_key) DO NOTHING;

-- ─── 3. Challenges / missions ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mobile_loyalty_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_key TEXT UNIQUE NOT NULL CHECK (challenge_key ~ '^[a-z0-9_]+$' AND length(challenge_key) BETWEEN 1 AND 48),
  title_fr TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  description_fr TEXT,
  description_ar TEXT,
  icon TEXT DEFAULT 'flag-outline',
  challenge_type TEXT NOT NULL CHECK (challenge_type IN
    ('first_order','spend_amount','order_count','review','invite_friends','category_purchase','daily_visit')),
  target_value NUMERIC(12,2) NOT NULL DEFAULT 1 CHECK (target_value > 0),
  reward_points INTEGER NOT NULL DEFAULT 0 CHECK (reward_points >= 0),
  reward_coupon_id UUID REFERENCES public.mobile_coupons(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  max_completions_per_user INTEGER DEFAULT 1 CHECK (max_completions_per_user IS NULL OR max_completions_per_user >= 1),
  target_wilayas TEXT[] DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS mobile_loyalty_challenges_active_idx
  ON public.mobile_loyalty_challenges (is_active, sort_order);
CREATE INDEX IF NOT EXISTS mobile_loyalty_challenges_window_idx
  ON public.mobile_loyalty_challenges (starts_at, ends_at);
CREATE INDEX IF NOT EXISTS mobile_loyalty_challenges_coupon_idx
  ON public.mobile_loyalty_challenges (reward_coupon_id) WHERE reward_coupon_id IS NOT NULL;

ALTER TABLE public.mobile_loyalty_challenges REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='mobile_loyalty_challenges') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.mobile_loyalty_challenges';
  END IF;
END $$;

ALTER TABLE public.mobile_loyalty_challenges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon read active challenges" ON public.mobile_loyalty_challenges;
CREATE POLICY "anon read active challenges" ON public.mobile_loyalty_challenges
  FOR SELECT TO anon, authenticated USING (
    is_active = TRUE
    AND (starts_at IS NULL OR starts_at <= NOW())
    AND (ends_at IS NULL OR ends_at > NOW())
  );

INSERT INTO public.mobile_loyalty_challenges (challenge_key, title_fr, title_ar, description_fr, description_ar, icon, challenge_type, target_value, reward_points, sort_order) VALUES
  ('first_order',
   'Première commande', 'أول طلب',
   'Passez votre première commande et gagnez vos premières étoiles VERKING.',
   'اطلب أول طلبية واربح أول نجوم فيركينغ خاصتك.',
   'cart-outline', 'first_order', 1, 200, 1),
  ('spend_5000',
   'Dépensez 5 000 DA', 'اصرف 5000 د.ج',
   'Cumulez 5 000 DA d''achats pour débloquer un bonus.',
   'اجمع 5000 د.ج من المشتريات لفتح المكافأة.',
   'wallet-outline', 'spend_amount', 5000, 300, 2),
  ('three_orders',
   '3 commandes ce mois', '3 طلبات هذا الشهر',
   'Passez 3 commandes pour booster votre niveau.',
   'اطلب 3 طلبات لتعزيز مستواك.',
   'rocket-outline', 'order_count', 3, 500, 3),
  ('invite_one',
   'Invitez un ami', 'ادعُ صديقًا',
   'Partagez votre code de parrainage et gagnez à chaque inscription.',
   'شارك رمز الإحالة واربح مع كل تسجيل.',
   'people-outline', 'invite_friends', 1, 200, 4)
ON CONFLICT (challenge_key) DO NOTHING;

-- ─── 4. Rewards catalogue ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mobile_loyalty_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_key TEXT UNIQUE NOT NULL CHECK (reward_key ~ '^[a-z0-9_]+$' AND length(reward_key) BETWEEN 1 AND 48),
  title_fr TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  description_fr TEXT,
  description_ar TEXT,
  icon TEXT DEFAULT 'gift-outline',
  image_url TEXT,
  cost_points INTEGER NOT NULL CHECK (cost_points > 0),
  reward_type TEXT NOT NULL CHECK (reward_type IN ('coupon','free_shipping','product','merch','custom')),
  coupon_id UUID REFERENCES public.mobile_coupons(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  stock INTEGER DEFAULT NULL CHECK (stock IS NULL OR stock >= 0),
  per_user_limit INTEGER DEFAULT 1 CHECK (per_user_limit IS NULL OR per_user_limit >= 1),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  required_level_key TEXT REFERENCES public.mobile_loyalty_levels(level_key) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS mobile_loyalty_rewards_active_idx
  ON public.mobile_loyalty_rewards (is_active, sort_order);
CREATE INDEX IF NOT EXISTS mobile_loyalty_rewards_window_idx
  ON public.mobile_loyalty_rewards (starts_at, ends_at);
CREATE INDEX IF NOT EXISTS mobile_loyalty_rewards_coupon_idx
  ON public.mobile_loyalty_rewards (coupon_id) WHERE coupon_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS mobile_loyalty_rewards_product_idx
  ON public.mobile_loyalty_rewards (product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS mobile_loyalty_rewards_level_idx
  ON public.mobile_loyalty_rewards (required_level_key) WHERE required_level_key IS NOT NULL;

ALTER TABLE public.mobile_loyalty_rewards REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='mobile_loyalty_rewards') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.mobile_loyalty_rewards';
  END IF;
END $$;

ALTER TABLE public.mobile_loyalty_rewards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon read active rewards" ON public.mobile_loyalty_rewards;
CREATE POLICY "anon read active rewards" ON public.mobile_loyalty_rewards
  FOR SELECT TO anon, authenticated USING (
    is_active = TRUE
    AND (starts_at IS NULL OR starts_at <= NOW())
    AND (ends_at IS NULL OR ends_at > NOW())
  );

INSERT INTO public.mobile_loyalty_rewards (reward_key, title_fr, title_ar, description_fr, description_ar, icon, cost_points, reward_type, sort_order) VALUES
  ('coupon_200da',
   'Bon de 200 DA', 'بون 200 د.ج',
   'Échangez vos étoiles contre un bon de 200 DA sur votre prochaine commande.',
   'استبدل نجومك ببون شراء بقيمة 200 د.ج للطلبية القادمة.',
   'pricetag-outline', 500, 'coupon', 1),
  ('free_shipping',
   'Livraison gratuite', 'توصيل مجاني',
   'Une livraison offerte pour votre prochaine commande, partout en Algérie.',
   'توصيل مجاني للطلب القادم في كافة الولايات.',
   'rocket-outline', 300, 'free_shipping', 2),
  ('coupon_1000da',
   'Bon de 1 000 DA', 'بون 1000 د.ج',
   'Le grand bon — 1 000 DA de remise dès 5 000 DA d''achats.',
   'البون الكبير — خصم 1000 د.ج ابتداء من 5000 د.ج من المشتريات.',
   'gift-outline', 2000, 'coupon', 3)
ON CONFLICT (reward_key) DO NOTHING;

-- ─── 5. Accounts (per-device balance) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mobile_loyalty_accounts (
  device_id TEXT PRIMARY KEY CHECK (length(device_id) BETWEEN 4 AND 128),
  user_id UUID,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  balance_points INTEGER NOT NULL DEFAULT 0 CHECK (balance_points >= 0),
  lifetime_points INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_points >= 0),
  pending_points INTEGER NOT NULL DEFAULT 0 CHECK (pending_points >= 0),
  tier_key TEXT REFERENCES public.mobile_loyalty_levels(level_key) ON DELETE SET NULL,
  referral_code TEXT UNIQUE,
  referred_by_code TEXT,
  signup_bonus_granted BOOLEAN NOT NULL DEFAULT FALSE,
  last_earned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS mobile_loyalty_accounts_user_idx
  ON public.mobile_loyalty_accounts (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS mobile_loyalty_accounts_customer_idx
  ON public.mobile_loyalty_accounts (customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS mobile_loyalty_accounts_tier_idx
  ON public.mobile_loyalty_accounts (tier_key);
CREATE INDEX IF NOT EXISTS mobile_loyalty_accounts_referral_idx
  ON public.mobile_loyalty_accounts (referral_code);

ALTER TABLE public.mobile_loyalty_accounts REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='mobile_loyalty_accounts') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.mobile_loyalty_accounts';
  END IF;
END $$;

ALTER TABLE public.mobile_loyalty_accounts ENABLE ROW LEVEL SECURITY;
-- Anon SELECT not allowed: account read goes through SECURITY DEFINER RPC
-- so a device only ever sees its own row. Service role retains full access.

-- ─── 6. Ledger (append-only) ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mobile_loyalty_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL CHECK (length(device_id) BETWEEN 4 AND 128),
  user_id UUID,
  event_type TEXT NOT NULL CHECK (event_type IN
    ('earn_signup','earn_order','earn_referral','earn_challenge','earn_review','earn_admin',
     'redeem_reward','expire','admin_adjust')),
  points_delta INTEGER NOT NULL,
  balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
  reference_id TEXT,
  reference_type TEXT CHECK (reference_type IS NULL OR reference_type IN ('order','challenge','reward','referral','manual')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS mobile_loyalty_ledger_device_idx
  ON public.mobile_loyalty_ledger (device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mobile_loyalty_ledger_event_idx
  ON public.mobile_loyalty_ledger (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS mobile_loyalty_ledger_reference_idx
  ON public.mobile_loyalty_ledger (reference_type, reference_id) WHERE reference_id IS NOT NULL;

ALTER TABLE public.mobile_loyalty_ledger ENABLE ROW LEVEL SECURITY;

-- ─── 7. User challenge progress ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mobile_loyalty_user_challenges (
  device_id TEXT NOT NULL CHECK (length(device_id) BETWEEN 4 AND 128),
  challenge_id UUID NOT NULL REFERENCES public.mobile_loyalty_challenges(id) ON DELETE CASCADE,
  user_id UUID,
  progress_value NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (progress_value >= 0),
  completions INTEGER NOT NULL DEFAULT 0 CHECK (completions >= 0),
  last_completed_at TIMESTAMPTZ,
  reward_claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (device_id, challenge_id)
);
CREATE INDEX IF NOT EXISTS mobile_loyalty_user_challenges_chall_idx
  ON public.mobile_loyalty_user_challenges (challenge_id);

ALTER TABLE public.mobile_loyalty_user_challenges REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='mobile_loyalty_user_challenges') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.mobile_loyalty_user_challenges';
  END IF;
END $$;

ALTER TABLE public.mobile_loyalty_user_challenges ENABLE ROW LEVEL SECURITY;

-- ─── 8. User redemption history ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mobile_loyalty_user_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL CHECK (length(device_id) BETWEEN 4 AND 128),
  user_id UUID,
  reward_id UUID NOT NULL REFERENCES public.mobile_loyalty_rewards(id) ON DELETE RESTRICT,
  cost_points INTEGER NOT NULL CHECK (cost_points >= 0),
  delivered_via TEXT CHECK (delivered_via IS NULL OR delivered_via IN ('coupon_attached','order_credit','manual')),
  delivered_reference_id TEXT,
  status TEXT NOT NULL DEFAULT 'delivered' CHECK (status IN ('pending','delivered','expired','cancelled')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS mobile_loyalty_user_rewards_device_idx
  ON public.mobile_loyalty_user_rewards (device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mobile_loyalty_user_rewards_reward_idx
  ON public.mobile_loyalty_user_rewards (reward_id);

ALTER TABLE public.mobile_loyalty_user_rewards REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='mobile_loyalty_user_rewards') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.mobile_loyalty_user_rewards';
  END IF;
END $$;

ALTER TABLE public.mobile_loyalty_user_rewards ENABLE ROW LEVEL SECURITY;

-- ─── Touch trigger for updated_at ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public._mobile_loyalty_touch()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public._mobile_loyalty_touch() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._mobile_loyalty_touch() FROM anon;
REVOKE EXECUTE ON FUNCTION public._mobile_loyalty_touch() FROM authenticated;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
      'mobile_loyalty_settings','mobile_loyalty_levels','mobile_loyalty_challenges',
      'mobile_loyalty_rewards','mobile_loyalty_accounts','mobile_loyalty_user_challenges',
      'mobile_loyalty_user_rewards'])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS %I ON public.%I; CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public._mobile_loyalty_touch();',
      t || '_touch', t, t || '_touch', t);
  END LOOP;
END $$;

-- ─── Helpers ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._loyalty_compute_tier(p_lifetime INTEGER)
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tier TEXT;
BEGIN
  SELECT level_key INTO v_tier
    FROM public.mobile_loyalty_levels
    WHERE is_active = TRUE AND threshold_points <= p_lifetime
    ORDER BY threshold_points DESC
    LIMIT 1;
  RETURN v_tier;
END $$;

REVOKE EXECUTE ON FUNCTION public._loyalty_compute_tier(INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._loyalty_compute_tier(INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION public._loyalty_compute_tier(INTEGER) FROM authenticated;

CREATE OR REPLACE FUNCTION public._loyalty_random_referral_code()
RETURNS TEXT LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  alphabet CONSTANT TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code TEXT;
  v_attempts INTEGER := 0;
BEGIN
  LOOP
    v_attempts := v_attempts + 1;
    v_code := 'V' || (
      SELECT string_agg(substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1), '')
      FROM generate_series(1, 6)
    );
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.mobile_loyalty_accounts WHERE referral_code = v_code);
    IF v_attempts > 32 THEN
      RAISE EXCEPTION 'Could not allocate a unique referral code after 32 attempts';
    END IF;
  END LOOP;
  RETURN v_code;
END $$;

REVOKE EXECUTE ON FUNCTION public._loyalty_random_referral_code() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._loyalty_random_referral_code() FROM anon;
REVOKE EXECUTE ON FUNCTION public._loyalty_random_referral_code() FROM authenticated;

-- ─── RPC: get_or_create_account ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.loyalty_get_or_create_account(
  p_device_id TEXT,
  p_referred_by_code TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_settings public.mobile_loyalty_settings%ROWTYPE;
  v_account public.mobile_loyalty_accounts%ROWTYPE;
  v_tier TEXT;
BEGIN
  IF p_device_id IS NULL OR length(trim(p_device_id)) < 4 THEN
    RAISE EXCEPTION 'invalid device id';
  END IF;

  SELECT * INTO v_settings FROM public.mobile_loyalty_settings WHERE id = 'default';
  IF NOT FOUND OR v_settings.is_enabled = FALSE THEN
    RAISE EXCEPTION 'loyalty disabled';
  END IF;

  SELECT * INTO v_account FROM public.mobile_loyalty_accounts WHERE device_id = p_device_id FOR UPDATE;

  IF NOT FOUND THEN
    -- Create
    v_tier := public._loyalty_compute_tier(0);
    INSERT INTO public.mobile_loyalty_accounts (
      device_id, balance_points, lifetime_points, tier_key,
      referral_code, referred_by_code, signup_bonus_granted
    ) VALUES (
      p_device_id, 0, 0, v_tier,
      public._loyalty_random_referral_code(),
      NULLIF(trim(coalesce(p_referred_by_code,'')), ''),
      FALSE
    ) RETURNING * INTO v_account;

    -- Signup bonus, if configured
    IF v_settings.signup_bonus > 0 THEN
      UPDATE public.mobile_loyalty_accounts
      SET balance_points  = balance_points + v_settings.signup_bonus,
          lifetime_points = lifetime_points + v_settings.signup_bonus,
          tier_key        = public._loyalty_compute_tier(lifetime_points + v_settings.signup_bonus),
          signup_bonus_granted = TRUE,
          last_earned_at  = NOW()
      WHERE device_id = p_device_id
      RETURNING * INTO v_account;

      INSERT INTO public.mobile_loyalty_ledger (device_id, event_type, points_delta, balance_after, notes)
      VALUES (p_device_id, 'earn_signup', v_settings.signup_bonus, v_account.balance_points, 'Bonus de bienvenue');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'device_id', v_account.device_id,
    'balance_points', v_account.balance_points,
    'lifetime_points', v_account.lifetime_points,
    'pending_points', v_account.pending_points,
    'tier_key', v_account.tier_key,
    'referral_code', v_account.referral_code,
    'referred_by_code', v_account.referred_by_code,
    'signup_bonus_granted', v_account.signup_bonus_granted,
    'last_earned_at', v_account.last_earned_at,
    'created_at', v_account.created_at
  );
END $$;

-- Public callable
GRANT EXECUTE ON FUNCTION public.loyalty_get_or_create_account(TEXT, TEXT) TO anon, authenticated;

-- ─── RPC: earn_for_order ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.loyalty_earn_for_order(
  p_device_id TEXT,
  p_order_id TEXT,
  p_amount_da NUMERIC
) RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_settings public.mobile_loyalty_settings%ROWTYPE;
  v_account public.mobile_loyalty_accounts%ROWTYPE;
  v_points INTEGER;
  v_dup INTEGER;
BEGIN
  IF p_device_id IS NULL OR length(trim(p_device_id)) < 4 THEN
    RAISE EXCEPTION 'invalid device id';
  END IF;
  IF p_order_id IS NULL OR length(trim(p_order_id)) < 1 THEN
    RAISE EXCEPTION 'invalid order id';
  END IF;
  IF p_amount_da IS NULL OR p_amount_da <= 0 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;

  SELECT * INTO v_settings FROM public.mobile_loyalty_settings WHERE id = 'default';
  IF NOT FOUND OR v_settings.is_enabled = FALSE THEN
    RETURN jsonb_build_object('granted', FALSE, 'reason', 'disabled');
  END IF;

  -- Idempotency: refuse a second earn for the same order
  SELECT count(*) INTO v_dup FROM public.mobile_loyalty_ledger
    WHERE device_id = p_device_id AND event_type = 'earn_order'
      AND reference_type = 'order' AND reference_id = p_order_id;
  IF v_dup > 0 THEN
    RETURN jsonb_build_object('granted', FALSE, 'reason', 'duplicate');
  END IF;

  v_points := floor(p_amount_da * v_settings.earn_rate_per_da);
  IF v_points <= 0 THEN
    RETURN jsonb_build_object('granted', FALSE, 'reason', 'below_minimum');
  END IF;

  -- Account must exist (caller hits get_or_create first; we still upsert as a safety net)
  SELECT * INTO v_account FROM public.mobile_loyalty_accounts WHERE device_id = p_device_id FOR UPDATE;
  IF NOT FOUND THEN
    PERFORM public.loyalty_get_or_create_account(p_device_id, NULL);
    SELECT * INTO v_account FROM public.mobile_loyalty_accounts WHERE device_id = p_device_id FOR UPDATE;
  END IF;

  UPDATE public.mobile_loyalty_accounts
  SET balance_points  = balance_points + v_points,
      lifetime_points = lifetime_points + v_points,
      tier_key        = public._loyalty_compute_tier(lifetime_points + v_points),
      last_earned_at  = NOW()
  WHERE device_id = p_device_id
  RETURNING * INTO v_account;

  INSERT INTO public.mobile_loyalty_ledger (device_id, event_type, points_delta, balance_after, reference_type, reference_id, notes)
  VALUES (p_device_id, 'earn_order', v_points, v_account.balance_points, 'order', p_order_id,
          'Points sur commande ' || p_order_id);

  RETURN jsonb_build_object(
    'granted', TRUE,
    'points', v_points,
    'balance_points', v_account.balance_points,
    'lifetime_points', v_account.lifetime_points,
    'tier_key', v_account.tier_key
  );
END $$;

GRANT EXECUTE ON FUNCTION public.loyalty_earn_for_order(TEXT, TEXT, NUMERIC) TO anon, authenticated;

-- ─── RPC: complete_challenge ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.loyalty_complete_challenge(
  p_device_id TEXT,
  p_challenge_key TEXT,
  p_progress_delta NUMERIC DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_chall public.mobile_loyalty_challenges%ROWTYPE;
  v_progress public.mobile_loyalty_user_challenges%ROWTYPE;
  v_account public.mobile_loyalty_accounts%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_target NUMERIC;
  v_new_progress NUMERIC;
BEGIN
  IF p_device_id IS NULL OR length(trim(p_device_id)) < 4 THEN
    RAISE EXCEPTION 'invalid device id';
  END IF;

  SELECT * INTO v_chall FROM public.mobile_loyalty_challenges
    WHERE challenge_key = p_challenge_key AND is_active = TRUE
    AND (starts_at IS NULL OR starts_at <= v_now)
    AND (ends_at IS NULL OR ends_at > v_now);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('granted', FALSE, 'reason', 'unavailable');
  END IF;

  -- Ensure account exists
  PERFORM public.loyalty_get_or_create_account(p_device_id, NULL);

  -- Ensure progress row
  INSERT INTO public.mobile_loyalty_user_challenges (device_id, challenge_id, progress_value, completions)
  VALUES (p_device_id, v_chall.id, 0, 0)
  ON CONFLICT (device_id, challenge_id) DO NOTHING;

  SELECT * INTO v_progress FROM public.mobile_loyalty_user_challenges
    WHERE device_id = p_device_id AND challenge_id = v_chall.id FOR UPDATE;

  -- Stop if cap reached
  IF v_chall.max_completions_per_user IS NOT NULL AND v_progress.completions >= v_chall.max_completions_per_user THEN
    RETURN jsonb_build_object('granted', FALSE, 'reason', 'cap_reached',
                              'progress', v_progress.progress_value, 'target', v_chall.target_value);
  END IF;

  v_target := v_chall.target_value;
  v_new_progress := v_progress.progress_value + COALESCE(p_progress_delta, v_target);

  IF v_new_progress < v_target THEN
    UPDATE public.mobile_loyalty_user_challenges
       SET progress_value = v_new_progress
     WHERE device_id = p_device_id AND challenge_id = v_chall.id;
    RETURN jsonb_build_object('granted', FALSE, 'reason', 'in_progress',
                              'progress', v_new_progress, 'target', v_target);
  END IF;

  -- Crossed the threshold — credit the reward
  UPDATE public.mobile_loyalty_user_challenges
     SET progress_value     = 0,
         completions        = completions + 1,
         last_completed_at  = v_now,
         reward_claimed_at  = v_now
   WHERE device_id = p_device_id AND challenge_id = v_chall.id;

  IF v_chall.reward_points > 0 THEN
    UPDATE public.mobile_loyalty_accounts
       SET balance_points  = balance_points + v_chall.reward_points,
           lifetime_points = lifetime_points + v_chall.reward_points,
           tier_key        = public._loyalty_compute_tier(lifetime_points + v_chall.reward_points),
           last_earned_at  = v_now
     WHERE device_id = p_device_id
    RETURNING * INTO v_account;

    INSERT INTO public.mobile_loyalty_ledger (device_id, event_type, points_delta, balance_after, reference_type, reference_id, notes)
    VALUES (p_device_id, 'earn_challenge', v_chall.reward_points, v_account.balance_points, 'challenge', v_chall.id::text,
            'Défi: ' || v_chall.challenge_key);
  ELSE
    SELECT * INTO v_account FROM public.mobile_loyalty_accounts WHERE device_id = p_device_id;
  END IF;

  RETURN jsonb_build_object(
    'granted', TRUE,
    'points', v_chall.reward_points,
    'balance_points', v_account.balance_points,
    'lifetime_points', v_account.lifetime_points,
    'tier_key', v_account.tier_key,
    'challenge_id', v_chall.id,
    'coupon_id', v_chall.reward_coupon_id
  );
END $$;

GRANT EXECUTE ON FUNCTION public.loyalty_complete_challenge(TEXT, TEXT, NUMERIC) TO anon, authenticated;

-- ─── RPC: redeem_reward ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.loyalty_redeem_reward(
  p_device_id TEXT,
  p_reward_key TEXT
) RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_settings public.mobile_loyalty_settings%ROWTYPE;
  v_reward public.mobile_loyalty_rewards%ROWTYPE;
  v_account public.mobile_loyalty_accounts%ROWTYPE;
  v_count INTEGER;
  v_redemption_id UUID;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF p_device_id IS NULL OR length(trim(p_device_id)) < 4 THEN
    RAISE EXCEPTION 'invalid device id';
  END IF;

  SELECT * INTO v_settings FROM public.mobile_loyalty_settings WHERE id = 'default';
  IF NOT FOUND OR v_settings.is_enabled = FALSE THEN
    RETURN jsonb_build_object('granted', FALSE, 'reason', 'disabled');
  END IF;

  SELECT * INTO v_reward FROM public.mobile_loyalty_rewards
    WHERE reward_key = p_reward_key AND is_active = TRUE
    AND (starts_at IS NULL OR starts_at <= v_now)
    AND (ends_at IS NULL OR ends_at > v_now)
    FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('granted', FALSE, 'reason', 'unavailable');
  END IF;

  IF v_reward.stock IS NOT NULL AND v_reward.stock <= 0 THEN
    RETURN jsonb_build_object('granted', FALSE, 'reason', 'out_of_stock');
  END IF;

  PERFORM public.loyalty_get_or_create_account(p_device_id, NULL);
  SELECT * INTO v_account FROM public.mobile_loyalty_accounts WHERE device_id = p_device_id FOR UPDATE;

  IF v_account.balance_points < v_reward.cost_points THEN
    RETURN jsonb_build_object('granted', FALSE, 'reason', 'insufficient_points',
                              'balance', v_account.balance_points, 'cost', v_reward.cost_points);
  END IF;

  -- Check tier requirement
  IF v_reward.required_level_key IS NOT NULL THEN
    DECLARE v_required_threshold INTEGER;
    BEGIN
      SELECT threshold_points INTO v_required_threshold FROM public.mobile_loyalty_levels
       WHERE level_key = v_reward.required_level_key;
      IF v_required_threshold IS NOT NULL AND v_account.lifetime_points < v_required_threshold THEN
        RETURN jsonb_build_object('granted', FALSE, 'reason', 'tier_locked',
                                  'required_level', v_reward.required_level_key);
      END IF;
    END;
  END IF;

  -- Per-user limit
  IF v_reward.per_user_limit IS NOT NULL THEN
    SELECT count(*) INTO v_count FROM public.mobile_loyalty_user_rewards
      WHERE device_id = p_device_id AND reward_id = v_reward.id AND status IN ('pending','delivered');
    IF v_count >= v_reward.per_user_limit THEN
      RETURN jsonb_build_object('granted', FALSE, 'reason', 'limit_reached');
    END IF;
  END IF;

  -- Debit balance
  UPDATE public.mobile_loyalty_accounts
     SET balance_points = balance_points - v_reward.cost_points
   WHERE device_id = p_device_id
  RETURNING * INTO v_account;

  -- Decrement stock if finite
  IF v_reward.stock IS NOT NULL THEN
    UPDATE public.mobile_loyalty_rewards SET stock = stock - 1 WHERE id = v_reward.id;
  END IF;

  -- Record the redemption
  INSERT INTO public.mobile_loyalty_user_rewards (device_id, reward_id, cost_points, delivered_via, status)
  VALUES (p_device_id, v_reward.id, v_reward.cost_points,
          CASE WHEN v_reward.reward_type = 'coupon' THEN 'coupon_attached' ELSE 'order_credit' END,
          'delivered')
  RETURNING id INTO v_redemption_id;

  -- Ledger entry
  INSERT INTO public.mobile_loyalty_ledger (device_id, event_type, points_delta, balance_after, reference_type, reference_id, notes)
  VALUES (p_device_id, 'redeem_reward', -v_reward.cost_points, v_account.balance_points, 'reward', v_reward.id::text,
          'Échange: ' || v_reward.reward_key);

  RETURN jsonb_build_object(
    'granted', TRUE,
    'redemption_id', v_redemption_id,
    'reward_id', v_reward.id,
    'reward_type', v_reward.reward_type,
    'coupon_id', v_reward.coupon_id,
    'product_id', v_reward.product_id,
    'cost_points', v_reward.cost_points,
    'balance_points', v_account.balance_points,
    'lifetime_points', v_account.lifetime_points,
    'tier_key', v_account.tier_key
  );
END $$;

GRANT EXECUTE ON FUNCTION public.loyalty_redeem_reward(TEXT, TEXT) TO anon, authenticated;

-- ─── RPC: list_my_ledger ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.loyalty_list_my_ledger(
  p_device_id TEXT,
  p_limit INTEGER DEFAULT 30
) RETURNS SETOF public.mobile_loyalty_ledger
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.mobile_loyalty_ledger
   WHERE device_id = p_device_id
   ORDER BY created_at DESC
   LIMIT LEAST(GREATEST(coalesce(p_limit, 30), 1), 200)
$$;

GRANT EXECUTE ON FUNCTION public.loyalty_list_my_ledger(TEXT, INTEGER) TO anon, authenticated;

-- ─── RPC: list_my_progress ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.loyalty_list_my_progress(p_device_id TEXT)
RETURNS TABLE (
  challenge_id UUID,
  challenge_key TEXT,
  progress_value NUMERIC,
  target_value NUMERIC,
  completions INTEGER,
  last_completed_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.challenge_key,
         coalesce(uc.progress_value, 0) AS progress_value,
         c.target_value,
         coalesce(uc.completions, 0) AS completions,
         uc.last_completed_at
    FROM public.mobile_loyalty_challenges c
    LEFT JOIN public.mobile_loyalty_user_challenges uc
      ON uc.challenge_id = c.id AND uc.device_id = p_device_id
   WHERE c.is_active = TRUE
     AND (c.starts_at IS NULL OR c.starts_at <= NOW())
     AND (c.ends_at IS NULL OR c.ends_at > NOW())
   ORDER BY c.sort_order, c.created_at
$$;

GRANT EXECUTE ON FUNCTION public.loyalty_list_my_progress(TEXT) TO anon, authenticated;
