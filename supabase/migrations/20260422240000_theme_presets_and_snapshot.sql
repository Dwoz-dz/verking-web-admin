-- Theme presets & rollback snapshot persistence.
-- Moves presets and snapshots off browser localStorage so they survive
-- browser changes and are visible to any admin on any device.

-- 1) theme_settings metadata columns (currently only in KV, dropped from DB writes)
ALTER TABLE public.theme_settings
  ADD COLUMN IF NOT EXISTS theme_name         text        DEFAULT '',
  ADD COLUMN IF NOT EXISTS theme_description  text        DEFAULT '',
  ADD COLUMN IF NOT EXISTS published_at       timestamptz,
  ADD COLUMN IF NOT EXISTS rollback_available boolean     DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_snapshot      jsonb;

COMMENT ON COLUMN public.theme_settings.last_snapshot IS
  'Snapshot of the previous published theme so admins can roll back from any device.';

-- 2) theme_presets — persistent named presets shared across admins
CREATE TABLE IF NOT EXISTS public.theme_presets (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        text NOT NULL,
  description text DEFAULT '',
  theme       jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_theme_presets_created_at
  ON public.theme_presets(created_at DESC);

ALTER TABLE public.theme_presets ENABLE ROW LEVEL SECURITY;

-- Service role (used by the edge function) already bypasses RLS; no policy needed.
-- Anonymous readers have no access — theme presets are admin-only.
