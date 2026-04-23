-- Admin-driven branding assets (stored as URLs in theme settings)
alter table public.theme_settings
  add column if not exists logo_url text;

alter table public.theme_settings
  add column if not exists secondary_logo_url text;

alter table public.theme_settings
  add column if not exists hero_background_url text;
