-- Hero bento layout: each slide belongs to one of 4 "zones" rendered
-- on the homepage Hero — main (large left) + side_1 / side_2 / side_3
-- (stacked landscape banners on the right). Multiple slides per zone
-- still cycle as a carousel; if admin only sets one, that zone shows
-- a static slide.

alter table public.hero_slides
  add column if not exists zone text not null default 'main';

alter table public.hero_slides
  drop constraint if exists hero_slides_zone_check;
alter table public.hero_slides
  add constraint hero_slides_zone_check
  check (zone in ('main', 'side_1', 'side_2', 'side_3'));

create index if not exists hero_slides_zone_pos_idx
  on public.hero_slides (zone, position);

-- Replace the upsert RPC with a version that accepts p_zone.
-- DROP first because the parameter list changes — Postgres treats it
-- as a new function signature otherwise.
drop function if exists public.hero_slides_upsert(
  text, uuid, boolean, text, text, text, integer, text,
  text, text, text, text, text, text, text, jsonb, integer
);

create or replace function public.hero_slides_upsert(
  p_token text, p_id uuid, p_is_active boolean, p_media_type text,
  p_media_url text, p_poster_url text, p_duration_ms integer, p_transition text,
  p_title_fr text, p_title_ar text, p_subtitle_fr text, p_subtitle_ar text,
  p_cta_label_fr text, p_cta_label_ar text, p_cta_url text,
  p_text_panel jsonb, p_position integer, p_zone text default 'main'
) returns public.hero_slides language plpgsql security definer
set search_path = public as $$
declare
  v_row public.hero_slides;
  v_pos integer;
  v_mt text := coalesce(p_media_type, 'image');
  v_tr text := coalesce(p_transition, 'fade');
  v_zn text := coalesce(p_zone, 'main');
begin
  if not public._vk_admin_token_valid(p_token) then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;
  if v_mt not in ('image','video') then v_mt := 'image'; end if;
  if v_tr not in ('fade','slide','zoom') then v_tr := 'fade'; end if;
  if v_zn not in ('main','side_1','side_2','side_3') then v_zn := 'main'; end if;

  if p_id is null then
    -- New slide: position is per-zone now (0-based per zone), so the
    -- ordering inside one bento slot stays predictable when admins
    -- reshuffle slides between zones.
    if p_position is not null then v_pos := p_position;
    else
      select coalesce(max(position), -1) + 1 into v_pos
      from public.hero_slides where zone = v_zn;
    end if;

    insert into public.hero_slides (
      position, is_active, media_type, media_url, poster_url, duration_ms, transition,
      title_fr, title_ar, subtitle_fr, subtitle_ar,
      cta_label_fr, cta_label_ar, cta_url, text_panel, zone
    ) values (
      v_pos, coalesce(p_is_active, true), v_mt, p_media_url, p_poster_url,
      greatest(coalesce(p_duration_ms, 4000), 1500), v_tr,
      p_title_fr, p_title_ar, p_subtitle_fr, p_subtitle_ar,
      p_cta_label_fr, p_cta_label_ar, p_cta_url,
      coalesce(p_text_panel, '{}'::jsonb), v_zn
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
      text_panel = coalesce(p_text_panel, text_panel),
      zone = v_zn
    where id = p_id returning * into v_row;
  end if;
  return v_row;
end; $$;

grant execute on function public.hero_slides_upsert(
  text, uuid, boolean, text, text, text, integer, text,
  text, text, text, text, text, text, text, jsonb, integer, text
) to anon, authenticated;
