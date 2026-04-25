-- Explicit RLS policies for theme_presets.
--
-- The previous migration (20260422240000_theme_presets_and_snapshot.sql)
-- enabled RLS but did not declare any policy, leaving the table in the
-- ambiguous "RLS on, no policies = deny everything except service_role"
-- state. That happens to be the correct behavior for our admin-only
-- preset library, but it's brittle: any future migration that grants
-- access to authenticated users without re-reading this comment would
-- silently expose theme presets to all logged-in users.
--
-- This migration declares the deny intent explicitly so reviewers can
-- see at a glance that anon and authenticated roles get NOTHING, and
-- only the service-role-backed edge function (which bypasses RLS) can
-- read or write presets.

-- Re-assert RLS is on (idempotent).
ALTER TABLE public.theme_presets ENABLE ROW LEVEL SECURITY;

-- Drop any pre-existing policies with the names we're about to use so
-- this migration is idempotent across re-runs.
DROP POLICY IF EXISTS theme_presets_anon_no_access      ON public.theme_presets;
DROP POLICY IF EXISTS theme_presets_authenticated_no_access ON public.theme_presets;

-- Anonymous (storefront, non-logged-in visitors) — no access.
CREATE POLICY theme_presets_anon_no_access
  ON public.theme_presets
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- Authenticated users — also no direct access. Admins reach this table
-- exclusively through the make-server-ea36795c edge function, which
-- runs with the service_role key and therefore bypasses RLS.
CREATE POLICY theme_presets_authenticated_no_access
  ON public.theme_presets
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.theme_presets IS
  'Admin-only theme preset library. Direct access is denied for anon and authenticated roles via RLS — all reads/writes must go through the make-server-ea36795c edge function which uses the service_role key.';
