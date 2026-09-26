-- ============================================================================
-- S13 (order status state machine): converge the trigger to the strict matrix.
--
-- WHAT: CREATE OR REPLACE public.enforce_order_status_transition() with the
-- live-verified strict body (no-op functionally — live already enforces it):
--   hazirlaniyor -> {kargoda, teslim_edildi, iptal_edildi}
--   kargoda      -> {teslim_edildi, iptal_edildi}
-- anything else raises check_violation. Same-status updates pass through.
--
-- DRIFT TIMELINE (why this file exists):
--   * 20260801000600_order_operations.sql committed the original strict
--     trigger (without the direct hazirlaniyor->teslim_edildi edge).
--   * 20260801003000_relax_order_status_transition.sql relaxed it to
--     any-to-any for the dashboard selector.
--   * The orphaned admin_override_and_setting_hardening migration (recorded in
--     20260926000100) restored a strict matrix WITH the teslim_edildi edge
--     live, and added the audited reason-required super-admin override path
--     admin_override_order_status (mandatory reason 1..500, super-admin only,
--     order_notes row + order.status_override audit event).
-- Live = strict trigger + RPC override. This migration makes the repo say the
-- same. The trigger itself intentionally contains NO override logic: every
-- exceptional move goes through the audited RPC, never a direct write.
--
-- ROLLBACK: restore any earlier body; the matrix is enforced in three places
-- (trigger, admin_update_order_status, lib/admin/orders.ts) so a rollback
-- must touch all three to stay consistent.
--
-- BACKWARD COMPATIBILITY: body identical to live; no signature, grant or
-- trigger-binding change. Deployed status flows bind the same matrix.
-- ============================================================================

create or replace function public.enforce_order_status_transition()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.status = old.status then
    return new;
  end if;

  if (
    (old.status = 'hazirlaniyor' and new.status in ('kargoda', 'teslim_edildi', 'iptal_edildi'))
    or
    (old.status = 'kargoda' and new.status in ('teslim_edildi', 'iptal_edildi'))
  ) then
    return new;
  end if;

  raise exception 'Geçersiz durum geçişi.' using
    errcode = 'check_violation',
    detail = 'Bu geçişe izin verilmez: ' || old.status::text || ' -> ' || new.status::text,
    hint = 'Terminal durumdan geri dönüş yapılamaz.';
end;
$function$;
