-- ─────────────────────────────────────────────────────────────────
-- Stock Manager
--   * stock_movements ledger table
--   * _vk_admin_token_valid(text)   — shared token validator
--   * admin_adjust_stock RPC        — set/increase/decrease/threshold
--   * admin_stock_movements RPC     — paginated history
--   * auto-log trigger on products  — captures order-driven stock deltas
-- Idempotent: safe to re-run.
-- ─────────────────────────────────────────────────────────────────

create extension if not exists "uuid-ossp";

-- ── 1. Ledger table ──────────────────────────────────────────────
create table if not exists public.stock_movements (
  id            uuid primary key default uuid_generate_v4(),
  product_id    uuid not null references public.products(id) on delete cascade,
  action_type   text not null,         -- 'set' | 'increase' | 'decrease' | 'threshold' | 'order_consume' | 'order_restore' | 'system_auto'
  old_quantity  integer,
  new_quantity  integer,
  delta         integer,
  reason        text,
  admin_label   text,
  source        text not null default 'system_auto',
  metadata      jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists stock_movements_product_idx on public.stock_movements (product_id, created_at desc);
create index if not exists stock_movements_created_idx on public.stock_movements (created_at desc);
create index if not exists stock_movements_source_idx  on public.stock_movements (source);

-- ── 2. Admin token validator ─────────────────────────────────────
create or replace function public._vk_admin_token_valid(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id text;
  v_active   boolean;
  v_config   text;
  v_json     jsonb;
begin
  if p_token is null or length(p_token) = 0 then
    return false;
  end if;

  -- Path 1: DB session token — format "vk_session:<uuid>:<nonce>"
  if p_token like 'vk_session:%' then
    v_admin_id := split_part(p_token, ':', 2);
    begin
      select is_active into v_active from public.admin_users where id::text = v_admin_id;
      if v_active is true then
        return true;
      end if;
    exception when others then
      -- fall through to KV path
      null;
    end;
  end if;

  -- Path 2: KV fallback — kv_store_ea36795c[key='admin:config'].value.token
  begin
    select value::text into v_config from public.kv_store_ea36795c where key = 'admin:config' limit 1;
    if v_config is not null then
      begin
        v_json := v_config::jsonb;
        if (v_json->>'token') = p_token then
          return true;
        end if;
      exception when others then
        -- legacy string-encoded JSON
        if trim(both '"' from v_config) = p_token then
          return true;
        end if;
      end;
    end if;
  exception when others then
    null;
  end;

  -- Path 3: hard-coded emergency fallback (matches edge function auth.ts)
  if p_token = 'vk-admin-secure-token-2024' then
    return true;
  end if;

  return false;
end;
$$;

grant execute on function public._vk_admin_token_valid(text) to anon, authenticated;

-- ── 3. admin_adjust_stock RPC ────────────────────────────────────
create or replace function public.admin_adjust_stock(
  p_token       text,
  p_product_id  uuid,
  p_mode        text,
  p_value       integer,
  p_reason      text default null,
  p_admin_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old        integer;
  v_new        integer;
  v_delta      integer;
  v_threshold  integer;
begin
  if not public._vk_admin_token_valid(p_token) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  if p_product_id is null then
    raise exception 'product_id required' using errcode = '22023';
  end if;

  if p_mode not in ('set', 'increase', 'decrease', 'threshold') then
    raise exception 'invalid mode: %', p_mode using errcode = '22023';
  end if;

  if p_mode = 'threshold' then
    v_threshold := greatest(0, coalesce(p_value, 0));
    update public.products
       set low_stock_threshold = v_threshold,
           updated_at = now()
     where id = p_product_id;

    insert into public.stock_movements
      (product_id, action_type, old_quantity, new_quantity, delta, reason, admin_label, source, metadata)
    values
      (p_product_id, 'threshold', null, null, null, p_reason, p_admin_label, 'admin_manual',
       jsonb_build_object('threshold', v_threshold));

    return jsonb_build_object(
      'success', true,
      'mode', 'threshold',
      'product_id', p_product_id,
      'new_threshold', v_threshold
    );
  end if;

  select coalesce(stock, 0) into v_old from public.products where id = p_product_id for update;

  if not found then
    raise exception 'product not found' using errcode = 'P0002';
  end if;

  if p_mode = 'set' then
    v_new := greatest(0, coalesce(p_value, 0));
  elsif p_mode = 'increase' then
    v_new := greatest(0, v_old + coalesce(p_value, 0));
  elsif p_mode = 'decrease' then
    v_new := greatest(0, v_old - coalesce(p_value, 0));
  end if;

  v_delta := v_new - v_old;

  -- Tell the auto-log trigger that this change is admin-sourced so it
  -- records the correct source+reason instead of 'system_auto'.
  perform set_config('vk.stock_source', 'admin_manual', true);
  perform set_config('vk.stock_reason', coalesce(p_reason, ''), true);
  perform set_config('vk.stock_admin_label', coalesce(p_admin_label, ''), true);
  perform set_config('vk.stock_action', p_mode, true);

  update public.products
     set stock = v_new,
         updated_at = now()
   where id = p_product_id;

  return jsonb_build_object(
    'success', true,
    'mode', p_mode,
    'product_id', p_product_id,
    'old_stock', v_old,
    'new_stock', v_new,
    'delta', v_delta
  );
end;
$$;

grant execute on function public.admin_adjust_stock(text, uuid, text, integer, text, text) to anon, authenticated;

-- ── 4. admin_stock_movements RPC ─────────────────────────────────
create or replace function public.admin_stock_movements(
  p_token      text,
  p_product_id uuid default null,
  p_limit      integer default 150
)
returns setof public.stock_movements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lim integer := greatest(1, least(coalesce(p_limit, 150), 1000));
begin
  if not public._vk_admin_token_valid(p_token) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  if p_product_id is null then
    return query
      select * from public.stock_movements
      order by created_at desc
      limit v_lim;
  else
    return query
      select * from public.stock_movements
      where product_id = p_product_id
      order by created_at desc
      limit v_lim;
  end if;
end;
$$;

grant execute on function public.admin_stock_movements(text, uuid, integer) to anon, authenticated;

-- ── 5. Auto-log trigger on products.stock ────────────────────────
-- Captures every stock change, including order-driven ones made by the
-- edge function. If admin_adjust_stock set the session variables, we
-- honour them; otherwise we default to source='system_auto'.
create or replace function public._vk_products_stock_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old       integer := coalesce(old.stock, 0);
  v_new       integer := coalesce(new.stock, 0);
  v_delta     integer;
  v_source    text;
  v_reason    text;
  v_label     text;
  v_action    text;
begin
  if v_old = v_new then
    return new;
  end if;

  v_delta  := v_new - v_old;
  v_source := coalesce(nullif(current_setting('vk.stock_source', true), ''), 'system_auto');
  v_reason := nullif(current_setting('vk.stock_reason', true), '');
  v_label  := nullif(current_setting('vk.stock_admin_label', true), '');
  v_action := coalesce(
    nullif(current_setting('vk.stock_action', true), ''),
    case when v_delta > 0 then 'increase' else 'decrease' end
  );

  insert into public.stock_movements
    (product_id, action_type, old_quantity, new_quantity, delta, reason, admin_label, source)
  values
    (new.id, v_action, v_old, v_new, v_delta, v_reason, v_label, v_source);

  -- Reset session vars so the next non-admin update falls back to
  -- system_auto without leaking the previous reason.
  perform set_config('vk.stock_source', '', true);
  perform set_config('vk.stock_reason', '', true);
  perform set_config('vk.stock_admin_label', '', true);
  perform set_config('vk.stock_action', '', true);

  return new;
end;
$$;

drop trigger if exists trg_vk_products_stock_audit on public.products;
create trigger trg_vk_products_stock_audit
  after update of stock on public.products
  for each row
  when (old.stock is distinct from new.stock)
  execute function public._vk_products_stock_audit();

-- ── 6. Realtime publication ──────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'stock_movements'
  ) then
    execute 'alter publication supabase_realtime add table public.stock_movements';
  end if;
exception when others then
  -- publication may not exist in local dev; ignore.
  null;
end$$;
