-- Core runtime tables required by the integrated admin/storefront server.
-- Safe to run multiple times.

create extension if not exists "uuid-ossp";

-- KV table used by fallback + metadata storage.
create table if not exists public.kv_store_ea36795c (
  key text primary key,
  value jsonb not null
);

-- Theme settings table used by /theme endpoints.
create table if not exists public.theme_settings (
  id integer primary key,
  primary_color text,
  accent_color text,
  bg_color text,
  font_heading text,
  font_body text,
  button_radius text,
  show_featured boolean default true,
  show_new_arrivals boolean default true,
  show_best_sellers boolean default true,
  show_wholesale_section boolean default true,
  show_testimonials boolean default true,
  logo_text text,
  logo_subtitle text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.theme_settings add column if not exists primary_color text;
alter table public.theme_settings add column if not exists accent_color text;
alter table public.theme_settings add column if not exists bg_color text;
alter table public.theme_settings add column if not exists font_heading text;
alter table public.theme_settings add column if not exists font_body text;
alter table public.theme_settings add column if not exists button_radius text;
alter table public.theme_settings add column if not exists show_featured boolean default true;
alter table public.theme_settings add column if not exists show_new_arrivals boolean default true;
alter table public.theme_settings add column if not exists show_best_sellers boolean default true;
alter table public.theme_settings add column if not exists show_wholesale_section boolean default true;
alter table public.theme_settings add column if not exists show_testimonials boolean default true;
alter table public.theme_settings add column if not exists logo_text text;
alter table public.theme_settings add column if not exists logo_subtitle text;
alter table public.theme_settings add column if not exists created_at timestamptz default now();
alter table public.theme_settings add column if not exists updated_at timestamptz default now();

-- Homepage sections table used by /homepage-config endpoints.
create table if not exists public.homepage_sections (
  id uuid primary key default uuid_generate_v4(),
  section_key text not null unique,
  is_enabled boolean default true,
  title_fr text default '',
  title_ar text default '',
  config jsonb not null default '{}'::jsonb,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.homepage_sections add column if not exists section_key text;
alter table public.homepage_sections add column if not exists is_enabled boolean default true;
alter table public.homepage_sections add column if not exists title_fr text default '';
alter table public.homepage_sections add column if not exists title_ar text default '';
alter table public.homepage_sections add column if not exists config jsonb not null default '{}'::jsonb;
alter table public.homepage_sections add column if not exists sort_order integer default 0;
alter table public.homepage_sections add column if not exists created_at timestamptz default now();
alter table public.homepage_sections add column if not exists updated_at timestamptz default now();

create unique index if not exists idx_homepage_sections_section_key
  on public.homepage_sections(section_key);

create index if not exists idx_homepage_sections_sort_order
  on public.homepage_sections(sort_order);

-- Newsletter subscribers table (kept here too for one-shot setup convenience).
create table if not exists public.newsletter_subscribers (
  id uuid primary key default uuid_generate_v4(),
  email text not null unique,
  locale text default 'fr',
  source text default 'newsletter_popup',
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.newsletter_subscribers add column if not exists locale text default 'fr';
alter table public.newsletter_subscribers add column if not exists source text default 'newsletter_popup';
alter table public.newsletter_subscribers add column if not exists is_active boolean default true;
alter table public.newsletter_subscribers add column if not exists created_at timestamptz default now();
alter table public.newsletter_subscribers add column if not exists updated_at timestamptz default now();
