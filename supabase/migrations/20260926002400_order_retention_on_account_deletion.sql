-- ============================================================================
-- Phase 2 — orders survive account deletion (retention-safe schema change).
--
-- WHAT:
--   1. orders.customer_detached_at timestamptz: when the owning account was
--      deleted. Null for every order that still has an owner.
--   2. orders.user_id becomes nullable, and orders_user_id_fkey changes from
--      ON DELETE CASCADE to ON DELETE SET NULL. Deleting an Auth user cascades
--      to profiles (unchanged), and profiles -> orders now detaches instead
--      of deleting. order_items, order_status_history and order_notes hang
--      off orders, so they survive with it.
--   3. orders_owner_or_detached: a row may only lack an owner if it records
--      when it was detached.
--   4. guard_orders_direct_update(): one new, narrow branch. The FK action
--      runs as a nested trigger (pg_trigger_depth() > 1); when that update
--      changes user_id from a value to null and NOTHING else, it is allowed
--      and stamps customer_detached_at = now(). A direct UPDATE at depth 1
--      still cannot touch user_id (verified on a temp-table replica before
--      this migration: direct null blocked at depth 1, cascade allowed at
--      depth 2). All other behavior is byte-identical.
--
-- WHY: a customer (or an admin in the dashboard) deleting an account used to
--   delete that customer's orders and order items, which are financial
--   records with a legal retention duty. Detached orders keep their own
--   snapshots (full_name, email, shipping_address, items); they become
--   invisible to customers (orders_select_own compares user_id) and remain
--   visible to administrators through the existing admin policies.
--
-- RETENTION: the retention period is a legal decision pending with the
--   owner's accountant. It is held in one code constant
--   (lib/account/retention.ts: ORDER_RECORD_RETENTION_YEARS). NOTHING purges
--   detached orders automatically — no job, trigger or function does.
--
-- IDEMPOTENT: if-not-exists / drop-if-exists guards; the FK and check are
--   dropped and re-created; create or replace for the function.
--
-- ROLLBACK (only while no order has been detached; detached rows have
--   user_id null and would violate NOT NULL):
--   alter table public.orders drop constraint if exists orders_owner_or_detached;
--   alter table public.orders drop constraint if exists orders_user_id_fkey;
--   alter table public.orders add constraint orders_user_id_fkey foreign key (user_id)
--     references public.profiles(id) on delete cascade;
--   alter table public.orders alter column user_id set not null;
--   alter table public.orders drop column if exists customer_detached_at;
--   then restore the guard from
--   /Users/mustafa/kabia-maturity-pass/db-snapshots/20260926T-phase2-05-order-retention-pre.sql
-- ============================================================================

alter table public.orders add column if not exists customer_detached_at timestamptz;

alter table public.orders alter column user_id drop not null;

alter table public.orders drop constraint if exists orders_user_id_fkey;
alter table public.orders
  add constraint orders_user_id_fkey foreign key (user_id)
  references public.profiles(id) on delete set null;

alter table public.orders drop constraint if exists orders_owner_or_detached;
alter table public.orders
  add constraint orders_owner_or_detached
  check (user_id is not null or customer_detached_at is not null);

create or replace function public.guard_orders_direct_update()
 returns trigger
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if current_setting('kabia.allow_order_write', true) = 'on' then return new; end if;
  -- Account deletion: the ON DELETE SET NULL referential action (a nested
  -- trigger) may detach the order from its deleted owner and change nothing
  -- else. A direct UPDATE runs at depth 1 and never reaches this branch.
  if pg_trigger_depth() > 1
     and old.user_id is not null and new.user_id is null
     and (to_jsonb(new) - 'user_id' - 'customer_detached_at') = (to_jsonb(old) - 'user_id' - 'customer_detached_at')
  then
    new.customer_detached_at := now();
    return new;
  end if;
  if new.status is distinct from old.status then raise exception 'Sipariş durumu yalnızca denetimli işlemle değiştirilebilir.' using errcode = '42501'; end if;
  if (to_jsonb(new) - 'tracking_carrier' - 'tracking_number') is distinct from (to_jsonb(old) - 'tracking_carrier' - 'tracking_number')
  then raise exception 'Yalnızca kargo bilgisi güncellenebilir.' using errcode = '42501'; end if;
  return new;
end;
$function$;

notify pgrst, 'reload schema';
