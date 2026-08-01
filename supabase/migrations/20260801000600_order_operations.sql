-- ---------------------------------------------------------------------------
-- Order operations for the dashboard: tracking, internal notes, and a status
-- machine enforced in the database.
--
-- The transition rules are a trigger rather than only an RPC, so an invalid
-- status change is impossible through any path — PostgREST, RPC or raw SQL.
--
--   hazirlaniyor  → kargoda | iptal_edildi
--   kargoda       → teslim_edildi | iptal_edildi
--   teslim_edildi → (terminal)
--   iptal_edildi  → (terminal)
--
-- No refund action exists anywhere in this migration or the dashboard: there is
-- no payment provider integration in this project, and a fake refund is worse
-- than none.
--
-- Rollback: drop the trigger and functions, drop order_notes, drop the two
-- tracking columns.
-- ---------------------------------------------------------------------------

alter table public.orders add column if not exists tracking_number  text;
alter table public.orders add column if not exists tracking_carrier text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_tracking_number_len_check') then
    alter table public.orders add constraint orders_tracking_number_len_check
      check (tracking_number is null or char_length(tracking_number) between 3 and 64);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_tracking_carrier_len_check') then
    alter table public.orders add constraint orders_tracking_carrier_len_check
      check (tracking_carrier is null or char_length(tracking_carrier) between 2 and 64);
  end if;
end $$;

-- ---- internal notes --------------------------------------------------------
-- Staff-only. There is deliberately no customer-facing policy on this table.

create table if not exists public.order_notes (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  admin_user_id uuid not null,
  note          text not null check (char_length(btrim(note)) between 1 and 2000),
  created_at    timestamptz not null default now()
);

comment on table public.order_notes is
  'Internal, staff-only notes on an order. Customers have no policy granting access to this table.';

create index if not exists idx_order_notes_order on public.order_notes (order_id, created_at desc);

alter table public.order_notes enable row level security;

drop policy if exists order_notes_admin_select on public.order_notes;
drop policy if exists order_notes_admin_insert on public.order_notes;

create policy order_notes_admin_select on public.order_notes
  for select to authenticated using (public.has_admin_role());
create policy order_notes_admin_insert on public.order_notes
  for insert to authenticated
  with check (public.has_admin_role() and admin_user_id = (select auth.uid()));

revoke all on public.order_notes from anon, authenticated;
grant select, insert on public.order_notes to authenticated;

-- ---- status machine --------------------------------------------------------

create or replace function public.enforce_order_status_transition()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if old.status = 'hazirlaniyor' and new.status in ('kargoda', 'iptal_edildi') then
    return new;
  end if;

  if old.status = 'kargoda' and new.status in ('teslim_edildi', 'iptal_edildi') then
    return new;
  end if;

  raise exception 'Geçersiz sipariş durumu geçişi: % → %', old.status, new.status
    using errcode = 'check_violation';
end;
$$;

drop trigger if exists trg_orders_status_transition on public.orders;
create trigger trg_orders_status_transition
before update of status on public.orders
for each row execute function public.enforce_order_status_transition();

revoke execute on function public.enforce_order_status_transition() from public, anon, authenticated;

-- Keep order_status_history complete no matter which path changes the status.
create or replace function public.record_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status is distinct from old.status then
    insert into public.order_status_history (order_id, status)
    values (new.id, new.status);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_orders_status_history on public.orders;
create trigger trg_orders_status_history
after update of status on public.orders
for each row execute function public.record_order_status_change();

revoke execute on function public.record_order_status_change() from public, anon, authenticated;

-- ---- audited status change -------------------------------------------------

create or replace function public.admin_update_order_status(
  p_order_id uuid,
  p_status   public.order_status,
  p_note     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_role     public.app_role := public.current_admin_role();
  v_previous public.order_status;
  v_number   text;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if v_role is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  -- Authoritative current value, read fresh and locked. A client-submitted
  -- "current status" is never trusted.
  select o.status, o.order_number into v_previous, v_number
  from public.orders o
  where o.id = p_order_id
  for update;

  if not found then
    raise exception 'Sipariş bulunamadı.' using errcode = 'no_data_found';
  end if;

  if v_previous = p_status then
    raise exception 'Sipariş zaten bu durumda.' using errcode = 'check_violation';
  end if;

  -- The transition trigger validates the move; this update will raise if it is
  -- not a legal edge.
  update public.orders set status = p_status where id = p_order_id;

  if p_note is not null and btrim(p_note) <> '' then
    insert into public.order_notes (order_id, admin_user_id, note)
    values (p_order_id, v_uid, btrim(p_note));
  end if;

  perform public.log_admin_action(
    case when p_status = 'iptal_edildi' then 'order.cancel' else 'order.status_change' end,
    'order',
    p_order_id::text,
    jsonb_build_object('status', v_previous),
    jsonb_build_object('status', p_status),
    jsonb_build_object('order_number', v_number, 'note', nullif(btrim(coalesce(p_note, '')), ''))
  );

  return jsonb_build_object(
    'order_id', p_order_id,
    'order_number', v_number,
    'previous_status', v_previous,
    'status', p_status
  );
end;
$$;

comment on function public.admin_update_order_status(uuid, public.order_status, text) is
  'Audited order status change. Re-reads the authoritative current status under a row lock and relies on the transition trigger for legality.';

revoke execute on function public.admin_update_order_status(uuid, public.order_status, text) from public, anon;
grant  execute on function public.admin_update_order_status(uuid, public.order_status, text) to authenticated;
