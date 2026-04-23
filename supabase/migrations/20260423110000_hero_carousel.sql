-- See docs/hero_carousel.sql-applied-via-mcp-apply_migration
-- Mirror of the migration already applied to project qvbskdjvnpjjmtufvnly.
-- Depends on public._vk_admin_token_valid (stock_manager migration).

create extension if not exists "uuid-ossp";

create table if not exists public.hero_slides (
  id              uuid primary key default uuid_generate_v4(),
  position        integer not null default 0,
  is_active       boolean not null default true,
  media_type      text not null default 'image',
  media_url       text,
  poster_url      text,
  duration_ms     integer not null default 4000,
  transition      text not null default 'fade',
  title_fr        text,
  title_ar        text,
  subtitle_fr     text,
  subtitle_ar     text,
  cta_label_fr    text,
  cta_label_ar    text,
  cta_url         text,
  text_panel      jsonb not null default jsonb_build_object(
    'bg_mode',       'gradient',
    'bg_color',      '#ffffff',
    'bg_gradient_from','#ffffff',
    'bg_gradient_to','#e0eaff',
    'bg_gradient_angle', 135,
    'bg_image_url',  '',
    'overlay_mode',  'light',
    'overlay_opacity', 0.35,
    'blur_px',       0,
    'text_color',    '#10223c',
    'align',         'start'
  ),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists hero_slides_active_pos_idx on public.hero_slides (is_active, position);
create index if not exists hero_slides_position_idx   on public.hero_slides (position);

create or replace function public._vk_hero_slides_touch()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists trg_vk_hero_slides_touch on public.hero_slides;
create trigger trg_vk_hero_slides_touch before update on public.hero_slides
  for each row execute function public._vk_hero_slides_touch();

alter table public.hero_slides enable row level security;
drop policy if exists "hero_slides_public_read_active" on public.hero_slides;
create policy "hero_slides_public_read_active" on public.hero_slides
  for select using (is_active = true);

-- RPC: list active (public)
create or replace function public.hero_slides_list_public()
returns setof public.hero_slides language sql stable security definer
set search_path = public as $$
  select * from public.hero_slides where is_active = true
  order by position asc, created_at asc;
$$;
grant execute on function public.hero_slides_list_public() to anon, authenticated;

-- RPC: list admin (all rows)
create or replace function public.hero_slides_list_admin(p_token text)
returns setof public.hero_slides language plpgsql stable security definer
set search_path = public as $$
begin
  if not public._vk_admin_token_valid(p_token) then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;
  return query select * from public.hero_slides order by position asc, created_at asc;
end;
$$;
grant execute on function public.hero_slides_list_admin(text) to anon, authenticated;

-- RPC: upsert
create or replace function public.hero_slides_upsert(
  p_token text, p_id uuid, p_is_active boolean, p_media_type text,
  p_media_url text, p_poster_url text, p_duration_ms integer, p_transition text,
  p_title_fr text, p_title_ar text, p_subtitle_fr text, p_subtitle_ar text,
  p_cta_label_fr text, p_cta_label_ar text, p_cta_url text,
  p_text_panel jsonb, p_position integer
) returns public.hero_slides language plpgsql security definer
set search_path = public as $$
declare
  v_row public.hero_slides; v_pos integer;
  v_mt text := coalesce(p_media_type, 'image');
  v_tr text := coalesce(p_transition, 'fade');
begin
  if not public._vk_admin_token_valid(p_token) then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;
  if v_mt not in ('image','video') then v_mt := 'image'; end if;
  if v_tr not in ('fade','slide','zoom') then v_tr := 'fade'; end if;

  if p_id is null then
    if p_position is not null then v_pos := p_position;
    else select coalesce(max(position), -1) + 1 into v_pos from public.hero_slides; end if;

    insert into public.hero_slides (
      position, is_active, media_type, media_url, poster_url, duration_ms, transition,
      title_fr, title_ar, subtitle_fr, subtitle_ar,
      cta_label_fr, cta_label_ar, cta_url, text_panel
    ) values (
      v_pos, coalesce(p_is_active, true), v_mt, p_media_url, p_poster_url,
      greatest(coalesce(p_duration_ms, 4000), 1500), v_tr,
      p_title_fr, p_title_ar, p_subtitle_fr, p_subtitle_ar,
      p_cta_label_fr, p_cta_label_ar, p_cta_url, coalesce(p_text_panel, '{}'::jsonb)
    ) returning * into v_row;
  else
    update public.hero_slides set
      position = coalesce(p_position, position),
      is_active = coalesce(p_is_active, is_active),
      media_type = v_mt, media_url = p_media_url, poster_url = p_poster_url,
      duration_ms = greatest(coalesce(p_duration_ms, duration_ms), 1500),
      transition = v_tr,
      title_fr = p_title_fr, title_ar = p_title_ar,
      subtitle_fr = p_subtitle_fr, subtitle_ar = p_subtitle_ar,
      cta_label_fr = p_cta_label_fr, cta_label_ar = p_cta_label_ar,
      cta_url = p_cta_url,
      text_panel = coalesce(p_text_panel, text_panel)
    where id = p_id returning * into v_row;
  end if;
  return v_row;
end; $$;
grant execute on function public.hero_slides_upsert(
  text,uuid,boolean,text,text,text,integer,text,text,text,text,text,text,text,text,jsonb,integer
) to anon, authenticated;

-- RPC: delete
create or replace function public.hero_slides_delete(p_token text, p_id uuid)
returns boolean language plpgsql security definer
set search_path = public as $$
begin
  if not public._vk_admin_token_valid(p_token) then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;
  delete from public.hero_slides where id = p_id;
  return true;
end; $$;
grant execute on function public.hero_slides_delete(text, uuid) to anon, authenticated;

-- RPC: duplicate
create or replace function public.hero_slides_duplicate(p_token text, p_id uuid)
returns public.hero_slides language plpgsql security definer
set search_path = public as $$
declare v_src public.hero_slides; v_new public.hero_slides; v_pos integer;
begin
  if not public._vk_admin_token_valid(p_token) then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;
  select * into v_src from public.hero_slides where id = p_id;
  if not found then raise exception 'Slide not found' using errcode = 'P0002'; end if;
  select coalesce(max(position), -1) + 1 into v_pos from public.hero_slides;
  insert into public.hero_slides (
    position, is_active, media_type, media_url, poster_url, duration_ms, transition,
    title_fr, title_ar, subtitle_fr, subtitle_ar,
    cta_label_fr, cta_label_ar, cta_url, text_panel
  ) values (
    v_pos, false, v_src.media_type, v_src.media_url, v_src.poster_url,
    v_src.duration_ms, v_src.transition,
    v_src.title_fr, v_src.title_ar, v_src.subtitle_fr, v_src.subtitle_ar,
    v_src.cta_label_fr, v_src.cta_label_ar, v_src.cta_url, v_src.text_panel
  ) returning * into v_new;
  return v_new;
end; $$;
grant execute on function public.hero_slides_duplicate(text, uuid) to anon, authenticated;

-- RPC: reorder
create or replace function public.hero_slides_reorder(p_token text, p_ids uuid[])
returns boolean language plpgsql security definer
set search_path = public as $$
declare v_id uuid; v_pos integer := 0;
begin
  if not public._vk_admin_token_valid(p_token) then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;
  foreach v_id in array p_ids loop
    update public.hero_slides set position = v_pos where id = v_id;
    v_pos := v_pos + 1;
  end loop;
  return true;
end; $$;
grant execute on function public.hero_slides_reorder(text, uuid[]) to anon, authenticated;

-- Realtime publication
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'hero_slides'
  ) then
    execute 'alter publication supabase_realtime add table public.hero_slides';
  end if;
end; $$;
