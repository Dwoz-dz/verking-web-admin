-- Phase 1 — Per-wilaya shipping config + seed.
--
-- Drives:
--   ▸ "Livrer vers [Wilaya]" header strip on the mobile Home
--   ▸ ETA badges on ProductCards
--   ▸ Cart auto-shipping fee
--   ▸ Per-wilaya banner overrides
--
-- One row per wilaya, FK to wilayas.code so the admin can never create a
-- ghost zone for a non-existent wilaya. All fee / threshold columns are
-- nullable except `fee` so the admin can leave fields blank and have the
-- mobile app fall back to the global cart settings (mobile_cart_settings).
--
-- carrier_default is text rather than enum so admins can add new carriers
-- (Yalidine / ZR Express / Ecotrack / DHL / …) without a schema change.

CREATE TABLE IF NOT EXISTS public.mobile_shipping_zones (
  wilaya_code TEXT PRIMARY KEY REFERENCES public.wilayas(code) ON DELETE CASCADE,
  fee NUMERIC NOT NULL DEFAULT 0,                  -- frais par défaut (DA)
  fee_desk NUMERIC,                                -- COD bureau (NULL = use fee)
  fee_home NUMERIC,                                -- COD domicile (NULL = use fee)
  free_threshold_override NUMERIC,                 -- per-wilaya free shipping (NULL = use mobile_cart_settings.free_delivery_threshold)
  eta_days_min INT,                                -- 1
  eta_days_max INT,                                -- 3
  carrier_default TEXT NOT NULL DEFAULT 'yalidine',
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  custom_banner_image TEXT,
  custom_banner_link TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (fee >= 0),
  CHECK (fee_desk IS NULL OR fee_desk >= 0),
  CHECK (fee_home IS NULL OR fee_home >= 0),
  CHECK (free_threshold_override IS NULL OR free_threshold_override >= 0),
  CHECK (eta_days_min IS NULL OR eta_days_min >= 0),
  CHECK (eta_days_max IS NULL OR eta_days_max >= 0),
  CHECK (
    eta_days_min IS NULL
    OR eta_days_max IS NULL
    OR eta_days_min <= eta_days_max
  )
);

COMMENT ON TABLE public.mobile_shipping_zones IS
  'Per-wilaya shipping config driving the mobile Home, ProductCard ETA, and cart shipping fee. One row per wilaya, FK-bound to wilayas.code.';

CREATE INDEX IF NOT EXISTS mobile_shipping_zones_enabled_idx ON public.mobile_shipping_zones (is_enabled);

-- RLS: anon may SELECT only enabled zones (so a disabled wilaya disappears
-- from the picker / Home strip), authenticated likewise. Writes are
-- service_role-only and go through admin-mobile-config.
ALTER TABLE public.mobile_shipping_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shipping_zones_anon_read   ON public.mobile_shipping_zones;
DROP POLICY IF EXISTS shipping_zones_authed_read ON public.mobile_shipping_zones;

CREATE POLICY shipping_zones_anon_read
  ON public.mobile_shipping_zones FOR SELECT TO anon
  USING (is_enabled = TRUE);

CREATE POLICY shipping_zones_authed_read
  ON public.mobile_shipping_zones FOR SELECT TO authenticated
  USING (is_enabled = TRUE);

-- Touch updated_at on every UPDATE so the realtime payload always reflects
-- the latest mutation (and admins can sort by it in the manager UI).
CREATE OR REPLACE FUNCTION public._mobile_shipping_zones_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mobile_shipping_zones_touch ON public.mobile_shipping_zones;
CREATE TRIGGER mobile_shipping_zones_touch
  BEFORE UPDATE ON public.mobile_shipping_zones
  FOR EACH ROW EXECUTE FUNCTION public._mobile_shipping_zones_touch();

-- Seed: one row per wilaya with safe defaults. Idempotent — re-running
-- this migration leaves the existing rows alone.
INSERT INTO public.mobile_shipping_zones (wilaya_code, fee, is_enabled)
SELECT code, 0, TRUE FROM public.wilayas
ON CONFLICT (wilaya_code) DO NOTHING;

-- Realtime: stream changes to the mobile app. Idempotent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'mobile_shipping_zones'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mobile_shipping_zones;
  END IF;
END
$$;

ALTER TABLE public.mobile_shipping_zones REPLICA IDENTITY FULL;
