-- ============================================================================
-- S2 (restock on cancel): only orders with stock_committed = true are
-- restocked, so orders placed before the decrement existed are never touched.
--
-- WHAT: CREATE OR REPLACE on both status RPCs (bodies otherwise identical to
-- the live versions snapshotted in db-snapshots/20260925T2344-status_machine-def.sql
-- and the §7 override read):
--   * public.admin_update_order_status: after the status UPDATE, when the new
--     status is iptal_edildi and the order's stock_committed is true, every
--     order_items line is added back to product_variants.stock_quantity with
--     an inventory_adjustments row (reason 'order.cancel', actor = the admin),
--     then stock_committed is cleared so a second cancel is a no-op.
--   * public.admin_override_order_status: same restock block (it can also move
--     orders into iptal_edildi, bypassing the matrix).
--   * Both RPCs set the S9-forward transaction flags up front:
--     kabia.allow_order_write (admits the audited status/flag UPDATEs past the
--     forthcoming direct-write guard) and kabia.allow_stock_write (admits the
--     restock past the forthcoming stock guard). No-ops until those triggers
--     land; harmless if they never do.
--
-- ROLLBACK: restore the two bodies from the snapshots named above.
--
-- BACKWARD COMPATIBILITY: signatures, grants, return shapes and the strict
-- matrix are unchanged. Deployed code paths (status RPC with 2-3 args,
-- override RPC with 3 args) bind identically. Rows written by deployed code
-- keep stock_committed = false and are therefore excluded from restock by
-- construction. Triggers on orders/variants are untouched by this migration.
-- ============================================================================

create or replace function public.admin_update_order_status(p_order_id uuid, p_status order_status, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid      uuid := (select auth.uid());
  v_role     public.app_role := public.current_admin_role();
  v_previous public.order_status;
  v_number   text;
  v_committed boolean := false;
  v_line record;
  v_restocked integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if v_role is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  -- S9/S10-forward: audited-writer flags (no-op until the guards land).
  perform set_config('kabia.allow_order_write', 'on', true);
  perform set_config('kabia.allow_stock_write', 'on', true);

  select o.status, o.order_number, o.stock_committed
    into v_previous, v_number, v_committed
  from public.orders o
  where o.id = p_order_id
  for update;

  if not found then
    raise exception 'Sipariş bulunamadı.' using errcode = 'no_data_found';
  end if;

  if v_previous = p_status then
    return jsonb_build_object(
      'order_id', p_order_id,
      'order_number', v_number,
      'previous_status', v_previous,
      'status', p_status,
      'idempotent', true
    );
  end if;

  if not (
    (v_previous = 'hazirlaniyor' and p_status in ('kargoda', 'teslim_edildi', 'iptal_edildi'))
    or
    (v_previous = 'kargoda' and p_status in ('teslim_edildi', 'iptal_edildi'))
  ) then
    raise exception 'Bu durum geçişine izin verilmez.' using
      errcode = 'check_violation',
      detail = v_previous::text || ' -> ' || p_status::text;
  end if;

  update public.orders set status = p_status where id = p_order_id;

  -- S2: restock exactly once, and only stock this branch committed.
  if p_status = 'iptal_edildi' and coalesce(v_committed, false) then
    for v_line in
      select variant_id, product_id, quantity
      from public.order_items
      where order_id = p_order_id
    loop
      update public.product_variants
      set stock_quantity = stock_quantity + v_line.quantity
      where id = v_line.variant_id
      returning stock_quantity into v_restocked;
      insert into public.inventory_adjustments
        (variant_id, product_id, admin_user_id, change_quantity,
         previous_quantity, new_quantity, reason, note)
      values
        (v_line.variant_id, v_line.product_id, v_uid, v_line.quantity,
         v_restocked - v_line.quantity, v_restocked, 'order.cancel', v_number);
    end loop;
    update public.orders set stock_committed = false where id = p_order_id;
  end if;

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
$function$;

create or replace function public.admin_override_order_status(p_order_id uuid, p_status order_status, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid      uuid := (select auth.uid());
  v_previous public.order_status;
  v_number   text;
  v_committed boolean := false;
  v_reason   text := btrim(coalesce(p_reason, ''));
  v_line record;
  v_restocked integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if not public.is_super_admin() then
    raise exception 'Bu işlem yalnızca süper yöneticiler için geçerlidir.' using errcode = '42501';
  end if;

  if v_reason = '' then
    raise exception 'Geçersiz durum geçişi için bir gerekçe girilmelidir.' using errcode = '23514';
  end if;
  if length(v_reason) > 500 then
    raise exception 'Gerekçe çok uzun.' using errcode = '22023';
  end if;

  -- S9/S10-forward: audited-writer flags (no-op until the guards land).
  perform set_config('kabia.allow_order_write', 'on', true);
  perform set_config('kabia.allow_stock_write', 'on', true);

  select o.status, o.order_number, o.stock_committed
    into v_previous, v_number, v_committed
  from public.orders o
  where o.id = p_order_id
  for update;

  if not found then
    raise exception 'Sipariş bulunamadı.' using errcode = 'no_data_found';
  end if;

  if v_previous = p_status then
    return jsonb_build_object(
      'order_id', p_order_id,
      'order_number', v_number,
      'previous_status', v_previous,
      'status', p_status,
      'override', true,
      'idempotent', true
    );
  end if;

  alter table public.orders disable trigger enforce_order_status_transition;
  update public.orders set status = p_status where id = p_order_id;
  alter table public.orders enable trigger enforce_order_status_transition;

  -- S2: restock exactly once, and only stock this branch committed.
  if p_status = 'iptal_edildi' and coalesce(v_committed, false) then
    for v_line in
      select variant_id, product_id, quantity
      from public.order_items
      where order_id = p_order_id
    loop
      update public.product_variants
      set stock_quantity = stock_quantity + v_line.quantity
      where id = v_line.variant_id
      returning stock_quantity into v_restocked;
      insert into public.inventory_adjustments
        (variant_id, product_id, admin_user_id, change_quantity,
         previous_quantity, new_quantity, reason, note)
      values
        (v_line.variant_id, v_line.product_id, v_uid, v_line.quantity,
         v_restocked - v_line.quantity, v_restocked, 'order.cancel', v_number);
    end loop;
    update public.orders set stock_committed = false where id = p_order_id;
  end if;

  insert into public.order_notes (order_id, admin_user_id, note)
  values (p_order_id, v_uid, 'GEÇERSİZ DURUM GEÇİŞİ: ' || v_reason);

  perform public.log_admin_action(
    'order.status_override',
    'order',
    p_order_id::text,
    jsonb_build_object('status', v_previous),
    jsonb_build_object('status', p_status),
    jsonb_build_object('order_number', v_number, 'override_reason', v_reason)
  );

  return jsonb_build_object(
    'order_id', p_order_id,
    'order_number', v_number,
    'previous_status', v_previous,
    'status', p_status,
    'override', true
  );
end;
$function$;
