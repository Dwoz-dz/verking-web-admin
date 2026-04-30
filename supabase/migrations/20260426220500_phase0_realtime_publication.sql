-- Phase 0 — enable Realtime broadcasts for mobile_* config tables.
--
-- supabase-js Postgres-changes subscriptions only fire when the table
-- is part of the `supabase_realtime` publication. This migration adds
-- the four config tables that drive admin-controlled mobile UI:
--
--   mobile_theme         — theme/colors
--   mobile_cart_settings — checkout knobs
--   mobile_home_sections — Home Builder section list
--   wilayas              — Phase 0 reference data (rare changes, but
--                          included so admin re-classifications and
--                          future regional pushes propagate live)
--
-- Idempotent: PostgreSQL raises an error if a table is already in the
-- publication, so we DO block-protect each ADD with an IF NOT EXISTS
-- equivalent via the pg_publication_tables view.

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'mobile_theme',
    'mobile_cart_settings',
    'mobile_home_sections',
    'wilayas'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END
$$;

-- supabase-js sends both the OLD and NEW row in UPDATE / DELETE events
-- when REPLICA IDENTITY is FULL. Without this, anything that reacts to
-- a change needs the primary key in the payload — fine for our use
-- case, but FULL gives us cleaner diffs for future debugging at
-- negligible cost on these tiny tables.
ALTER TABLE public.mobile_theme         REPLICA IDENTITY FULL;
ALTER TABLE public.mobile_cart_settings REPLICA IDENTITY FULL;
ALTER TABLE public.mobile_home_sections REPLICA IDENTITY FULL;
ALTER TABLE public.wilayas              REPLICA IDENTITY FULL;
