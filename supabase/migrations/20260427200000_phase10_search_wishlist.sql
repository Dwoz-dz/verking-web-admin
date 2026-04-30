-- Phase 10 — Search + Wishlist
--
-- Three tables + 8 SECURITY DEFINER RPCs. All mutations device-scoped.
--
--   ▸ mobile_search_history       per-device search log (last 30 retained)
--   ▸ mobile_search_trending      admin-curated trending queries (anon SELECT)
--   ▸ mobile_user_wishlist        per-device saved products
--
-- Public RPCs:
--   search_products(query, cycle?, limit) → ranked product ids
--   search_log(device, query, results, source)
--   search_recent_for_me(device, limit)
--   search_clear_recent(device)
--   wishlist_toggle(device, product) → { is_saved, total }
--   wishlist_get_my(device, limit)
--   wishlist_count_for_me(device)
--   wishlist_clear(device)
--
-- Idempotent — safe to re-run.

-- ─── 1. Search history ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mobile_search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL CHECK (length(device_id) BETWEEN 4 AND 128),
  user_id UUID,
  query TEXT NOT NULL CHECK (length(query) BETWEEN 1 AND 100),
  normalised_query TEXT NOT NULL,
  results_count INTEGER,
  source TEXT CHECK (source IS NULL OR source IN ('manual','trending','recent','voice','barcode')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mobile_search_history_device_idx
  ON public.mobile_search_history (device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mobile_search_history_normalised_idx
  ON public.mobile_search_history (normalised_query, created_at DESC);

ALTER TABLE public.mobile_search_history ENABLE ROW LEVEL SECURITY;
-- No anon SELECT — reads go through SECURITY DEFINER RPCs scoped to device.

-- ─── 2. Trending queries (admin) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mobile_search_trending (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT UNIQUE NOT NULL CHECK (length(query) BETWEEN 1 AND 80),
  label_fr TEXT NOT NULL,
  label_ar TEXT NOT NULL,
  icon TEXT,
  emoji TEXT,
  accent_color TEXT NOT NULL DEFAULT '#2D7DD2',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mobile_search_trending_active_idx
  ON public.mobile_search_trending (is_active, sort_order);

ALTER TABLE public.mobile_search_trending REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='mobile_search_trending') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.mobile_search_trending';
  END IF;
END $$;

ALTER TABLE public.mobile_search_trending ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon read active trending" ON public.mobile_search_trending;
CREATE POLICY "anon read active trending" ON public.mobile_search_trending
  FOR SELECT TO anon, authenticated USING (
    is_active = TRUE
    AND (starts_at IS NULL OR starts_at <= NOW())
    AND (ends_at IS NULL OR ends_at > NOW())
  );

INSERT INTO public.mobile_search_trending (query, label_fr, label_ar, emoji, accent_color, sort_order) VALUES
  ('cartable',     'Cartable',     'حقيبة مدرسية', '🎒', '#FF7A1A', 1),
  ('calculatrice', 'Calculatrice', 'آلة حاسبة',    '🧮', '#43D9DB', 2),
  ('stylo',        'Stylo',        'قلم',           '🖊️', '#2D7DD2', 3),
  ('cahier',       'Cahier',       'دفتر',          '📓', '#7C5DDB', 4),
  ('trousse',      'Trousse',      'مقلمة',         '✏️',  '#E85D6B', 5),
  ('agenda',       'Agenda',       'مذكرة',         '📅', '#4CAF80', 6)
ON CONFLICT (query) DO NOTHING;

-- ─── 3. User wishlist ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mobile_user_wishlist (
  device_id TEXT NOT NULL CHECK (length(device_id) BETWEEN 4 AND 128),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID,
  notes TEXT,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (device_id, product_id)
);

CREATE INDEX IF NOT EXISTS mobile_user_wishlist_device_idx
  ON public.mobile_user_wishlist (device_id, added_at DESC);
CREATE INDEX IF NOT EXISTS mobile_user_wishlist_product_idx
  ON public.mobile_user_wishlist (product_id);
CREATE INDEX IF NOT EXISTS mobile_user_wishlist_user_idx
  ON public.mobile_user_wishlist (user_id) WHERE user_id IS NOT NULL;

ALTER TABLE public.mobile_user_wishlist REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='mobile_user_wishlist') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.mobile_user_wishlist';
  END IF;
END $$;

ALTER TABLE public.mobile_user_wishlist ENABLE ROW LEVEL SECURITY;
-- Device-scoped via RPCs only.

-- ─── Touch trigger ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._mobile_search_touch()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END $$;
REVOKE EXECUTE ON FUNCTION public._mobile_search_touch() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._mobile_search_touch() FROM anon;
REVOKE EXECUTE ON FUNCTION public._mobile_search_touch() FROM authenticated;

DROP TRIGGER IF EXISTS mobile_search_trending_touch ON public.mobile_search_trending;
CREATE TRIGGER mobile_search_trending_touch BEFORE UPDATE ON public.mobile_search_trending
  FOR EACH ROW EXECUTE FUNCTION public._mobile_search_touch();

-- ─── RPC: search_products ──────────────────────────────────────────────
-- Multi-language ILIKE search with name > description weighting and
-- exact-match-first ordering. Arabic and French handled symmetrically.

CREATE OR REPLACE FUNCTION public.search_products(
  p_query TEXT,
  p_limit INTEGER DEFAULT 30
) RETURNS TABLE (
  id UUID,
  match_rank INTEGER,
  name_fr TEXT,
  name_ar TEXT,
  price NUMERIC,
  category_id TEXT,
  is_active BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH q AS (
    SELECT lower(trim(p_query)) AS qn,
           '%' || lower(trim(p_query)) || '%' AS qpat,
           lower(trim(p_query)) || '%' AS qprefix
  )
  SELECT
    p.id,
    CASE
      WHEN lower(p.name_fr) = (SELECT qn FROM q) OR lower(coalesce(p.name_ar,'')) = (SELECT qn FROM q) THEN 1
      WHEN lower(p.name_fr) ILIKE (SELECT qprefix FROM q) OR lower(coalesce(p.name_ar,'')) ILIKE (SELECT qprefix FROM q) THEN 2
      WHEN lower(p.name_fr) ILIKE (SELECT qpat FROM q) OR lower(coalesce(p.name_ar,'')) ILIKE (SELECT qpat FROM q) THEN 3
      ELSE 4
    END AS match_rank,
    p.name_fr,
    p.name_ar,
    p.price,
    p.category_id,
    p.is_active
  FROM public.products p
  WHERE p.is_active = TRUE
    AND (
      lower(p.name_fr) ILIKE (SELECT qpat FROM q)
      OR lower(coalesce(p.name_ar,'')) ILIKE (SELECT qpat FROM q)
      OR lower(coalesce(p.description_fr,'')) ILIKE (SELECT qpat FROM q)
      OR lower(coalesce(p.description_ar,'')) ILIKE (SELECT qpat FROM q)
    )
  ORDER BY match_rank, p.name_fr
  LIMIT LEAST(GREATEST(coalesce(p_limit, 30), 1), 100)
$$;

GRANT EXECUTE ON FUNCTION public.search_products(TEXT, INTEGER) TO anon, authenticated;

-- ─── RPC: search_log ───────────────────────────────────────────────────
-- Inserts a row + prunes the device's history to the 30 most recent.

CREATE OR REPLACE FUNCTION public.search_log(
  p_device_id TEXT,
  p_query TEXT,
  p_results_count INTEGER DEFAULT NULL,
  p_source TEXT DEFAULT 'manual'
) RETURNS BOOLEAN
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_norm TEXT;
BEGIN
  IF p_device_id IS NULL OR length(trim(p_device_id)) < 4 THEN
    RAISE EXCEPTION 'invalid device id';
  END IF;
  IF p_query IS NULL OR length(trim(p_query)) = 0 THEN RETURN FALSE; END IF;
  v_norm := lower(trim(p_query));
  IF length(v_norm) > 100 THEN RETURN FALSE; END IF;

  -- Dedupe: if the most recent search is the same query, don't insert again.
  IF EXISTS (
    SELECT 1 FROM public.mobile_search_history
     WHERE device_id = p_device_id
     ORDER BY created_at DESC
     LIMIT 1
  ) THEN
    PERFORM 1 FROM public.mobile_search_history
     WHERE device_id = p_device_id AND normalised_query = v_norm
     ORDER BY created_at DESC
     LIMIT 1;
    -- If the very last entry matches, just bump it.
    IF FOUND THEN
      UPDATE public.mobile_search_history
         SET created_at = NOW(),
             results_count = COALESCE(p_results_count, results_count)
       WHERE id = (
         SELECT id FROM public.mobile_search_history
          WHERE device_id = p_device_id AND normalised_query = v_norm
          ORDER BY created_at DESC LIMIT 1
       );
      RETURN TRUE;
    END IF;
  END IF;

  INSERT INTO public.mobile_search_history (device_id, query, normalised_query, results_count, source)
  VALUES (p_device_id, trim(p_query), v_norm, p_results_count,
          CASE WHEN p_source IN ('manual','trending','recent','voice','barcode') THEN p_source ELSE 'manual' END);

  -- Keep only the 30 most recent — simple TRIM via window function.
  DELETE FROM public.mobile_search_history
   WHERE id IN (
     SELECT id FROM (
       SELECT id, row_number() OVER (PARTITION BY device_id ORDER BY created_at DESC) AS rn
         FROM public.mobile_search_history WHERE device_id = p_device_id
     ) r WHERE rn > 30
   );
  RETURN TRUE;
END $$;

GRANT EXECUTE ON FUNCTION public.search_log(TEXT, TEXT, INTEGER, TEXT) TO anon, authenticated;

-- ─── RPC: search_recent_for_me ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.search_recent_for_me(
  p_device_id TEXT,
  p_limit INTEGER DEFAULT 8
) RETURNS TABLE (query TEXT, normalised_query TEXT, results_count INTEGER, source TEXT, created_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  -- Inner DISTINCT ON keeps the most-recent row per query; outer ORDER BY
  -- sorts the unique rows newest-first (without the wrapping subquery,
  -- DISTINCT ON's ORDER BY governs and recents would come back alphabetically).
  SELECT * FROM (
    SELECT DISTINCT ON (normalised_query) query, normalised_query, results_count, source, created_at
      FROM public.mobile_search_history
     WHERE device_id = p_device_id
     ORDER BY normalised_query, created_at DESC
  ) sub
  ORDER BY created_at DESC
  LIMIT LEAST(GREATEST(coalesce(p_limit, 8), 1), 30)
$$;

GRANT EXECUTE ON FUNCTION public.search_recent_for_me(TEXT, INTEGER) TO anon, authenticated;

-- ─── RPC: search_clear_recent ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.search_clear_recent(p_device_id TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_device_id IS NULL OR length(trim(p_device_id)) < 4 THEN RAISE EXCEPTION 'invalid device id'; END IF;
  DELETE FROM public.mobile_search_history WHERE device_id = p_device_id;
  RETURN TRUE;
END $$;

GRANT EXECUTE ON FUNCTION public.search_clear_recent(TEXT) TO anon, authenticated;

-- ─── RPC: wishlist_toggle ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.wishlist_toggle(
  p_device_id TEXT,
  p_product_id UUID
) RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_existed BOOLEAN;
  v_count INTEGER;
BEGIN
  IF p_device_id IS NULL OR length(trim(p_device_id)) < 4 THEN
    RAISE EXCEPTION 'invalid device id';
  END IF;

  -- Confirm product exists & is active before saving.
  PERFORM 1 FROM public.products WHERE id = p_product_id AND is_active = TRUE;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown or inactive product'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.mobile_user_wishlist
     WHERE device_id = p_device_id AND product_id = p_product_id
  ) INTO v_existed;

  IF v_existed THEN
    DELETE FROM public.mobile_user_wishlist
     WHERE device_id = p_device_id AND product_id = p_product_id;
  ELSE
    INSERT INTO public.mobile_user_wishlist (device_id, product_id)
    VALUES (p_device_id, p_product_id);
  END IF;

  SELECT count(*) INTO v_count FROM public.mobile_user_wishlist WHERE device_id = p_device_id;

  RETURN jsonb_build_object(
    'is_saved', NOT v_existed,
    'total', v_count,
    'product_id', p_product_id
  );
END $$;

GRANT EXECUTE ON FUNCTION public.wishlist_toggle(TEXT, UUID) TO anon, authenticated;

-- ─── RPC: wishlist_get_my ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.wishlist_get_my(
  p_device_id TEXT,
  p_limit INTEGER DEFAULT 100
) RETURNS TABLE (
  product_id UUID,
  added_at TIMESTAMPTZ,
  notes TEXT,
  name_fr TEXT,
  name_ar TEXT,
  price NUMERIC,
  category_id TEXT,
  is_active BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT w.product_id, w.added_at, w.notes,
         p.name_fr, p.name_ar, p.price, p.category_id, p.is_active
    FROM public.mobile_user_wishlist w
    LEFT JOIN public.products p ON p.id = w.product_id
   WHERE w.device_id = p_device_id
   ORDER BY w.added_at DESC
   LIMIT LEAST(GREATEST(coalesce(p_limit, 100), 1), 500)
$$;

GRANT EXECUTE ON FUNCTION public.wishlist_get_my(TEXT, INTEGER) TO anon, authenticated;

-- ─── RPC: wishlist_count_for_me ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.wishlist_count_for_me(p_device_id TEXT)
RETURNS INTEGER LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::INTEGER FROM public.mobile_user_wishlist WHERE device_id = p_device_id
$$;

GRANT EXECUTE ON FUNCTION public.wishlist_count_for_me(TEXT) TO anon, authenticated;

-- ─── RPC: wishlist_clear ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.wishlist_clear(p_device_id TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_device_id IS NULL OR length(trim(p_device_id)) < 4 THEN RAISE EXCEPTION 'invalid device id'; END IF;
  DELETE FROM public.mobile_user_wishlist WHERE device_id = p_device_id;
  RETURN TRUE;
END $$;

GRANT EXECUTE ON FUNCTION public.wishlist_clear(TEXT) TO anon, authenticated;
