-- Newsletter subscribers table for popup lead capture

create table if not exists public.newsletter_subscribers (
  id uuid primary key default uuid_generate_v4(),
  email text not null unique,
  locale text default 'fr',
  source text default 'newsletter_popup',
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

