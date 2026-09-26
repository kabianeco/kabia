-- ============================================================================
-- S9 (orders_admin_update grants every column): direct-write guard trigger.
--
-- WHAT: BEFORE UPDATE trigger guard_orders_direct_update on public.orders.
-- Direct PostgREST writes (no transaction flag) may touch ONLY
-- tracking_carrier and tracking_number — the one legitimate direct writer is
-- updateTrackingAction. Any status change outside the audited RPCs raises
-- 42501, as does any change to total/subtotal/user_id/snapshots/etc.
-- The audited RPCs (admin_update_order_status, admin_override_order_status)
-- set kabia.allow_order_write via set_config (added in the restock
-- migration) and pass through untouched. enforce_order_status_transition
-- remains the second line of defence for the matrix itself.
--
-- NOTE on the spec's column list: (status, tracking_carrier,
-- tracking_number, updated_at) — verified live 2026-09-26 that orders has NO
-- updated_at column, so the whitelist is tracking-only and status is
-- deny-by-default for direct writes (it must stay audited).
--
-- ROLLBACK: drop trigger trg_orders_direct_guard on public.orders;
-- drop function public.guard_orders_direct_update();
--
-- BACKWARD COMPATIBILITY: deployed code writes orders only through
-- create_order (INSERT, unaffected — triggers fire on UPDATE) and
-- admin_update_order_status / admin_override_order_status (flagged RPCs,
-- unaffected) plus the tracking PATCH (whitelisted columns, unaffected).
-- Verified the only direct UPDATE in app/ + lib/ is the tracking edit.
-- ============================================================================

create or replace function public.guard_orders_direct_update()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  -- Audited RPC bypass (transaction-local, auto-reset at commit/rollback).
  if current_setting('kabia.allow_order_write', true) = 'on' then
    return new;
  end if;
  -- Status moves outside the audited RPCs are rejected outright.
  if new.status is distinct from old.status then
    raise exception 'Sipariş durumu yalnızca denetimli işlemle değiştirilebilir.'
      using errcode = '42501';
  end if;
  -- Only tracking columns may move via direct writes.
  if (to_jsonb(new) - 'tracking_carrier' - 'tracking_number')
     is distinct from
     (to_jsonb(old) - 'tracking_carrier' - 'tracking_number')
  then
    raise exception 'Yalnızca kargo bilgisi güncellenebilir.' using errcode = '42501';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_orders_direct_guard on public.orders;
create trigger trg_orders_direct_guard
before update on public.orders
for each row
execute function public.guard_orders_direct_update();

revoke execute on function public.guard_orders_direct_update()
  from public, anon, authenticated;
