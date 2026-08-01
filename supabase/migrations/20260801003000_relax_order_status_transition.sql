-- ---------------------------------------------------------------------------
-- Relax order-status transition rules for administrators.
--
-- The dashboard now exposes a single status selector on the order detail
-- screen, so administrators can move an order to any state directly. The
-- order_status_history table still records every change, and the
-- admin_update_order_status RPC still rejects a no-op update, so the audit
-- trail remains complete.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_order_status_transition()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  -- All cross-status moves are permitted for administrators. The order detail
  -- screen relies on this; the audit trigger records the change.
  return new;
end;
$$;
