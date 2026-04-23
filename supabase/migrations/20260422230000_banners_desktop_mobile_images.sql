-- See index comment — desktop/mobile image variants + updated_at for banners.

ALTER TABLE public.banners
  ADD COLUMN IF NOT EXISTS desktop_image text DEFAULT '',
  ADD COLUMN IF NOT EXISTS mobile_image  text DEFAULT '',
  ADD COLUMN IF NOT EXISTS updated_at    timestamptz NOT NULL DEFAULT now();

UPDATE public.banners
   SET desktop_image = COALESCE(NULLIF(desktop_image, ''), image, ''),
       mobile_image  = COALESCE(NULLIF(mobile_image,  ''), image, '')
 WHERE desktop_image = '' OR mobile_image = '' OR desktop_image IS NULL OR mobile_image IS NULL;

COMMENT ON COLUMN public.banners.desktop_image IS 'Hero/banner asset for desktop viewports.';
COMMENT ON COLUMN public.banners.mobile_image  IS 'Hero/banner asset for mobile viewports (optional; falls back to desktop_image).';
