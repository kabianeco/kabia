-- ============================================================================
-- S10 (direct stock_quantity writes bypass the audit trail): only
-- admin_adjust_stock and create_order may move stock.
--
-- WHAT:
--   * BEFORE UPDATE OF stock_quantity trigger guard_variant_stock on
--     public.product_variants. Unflagged stock changes raise 42501. Label /
--     price / SKU edits (saveProductAction) and INSERTs of new variants are
--     untouched — the trigger fires only when stock_quantity itself moves.
--   * admin_adjust_stock re-created with a single added line —
--     set_config('kabia.allow_stock_write','on',true) after the auth checks
--     (live body snapshotted in db-snapshots/20260926-admin_adjust_stock-def.sql).
--     create_order and the cancel-restock blocks already set the same flag.
--
-- ROLLBACK: drop trigger trg_variants_stock_guard on public.product_variants;
-- drop function public.guard_variant_stock(); restore admin_adjust_stock from
-- the snapshot (or leave the set_config line — it is a harmless no-op
-- without the trigger).
--
-- BACKWARD COMPATIBILITY: deployed code moves stock only through
-- admin_adjust_stock (dashboard) — flagged, unaffected. The product editor's
-- label/price writes and new-variant inserts do not touch stock_quantity for
-- existing rows (verified in app/admin/(protected)/products/actions.ts) and
-- INSERTs never fire UPDATE triggers. No signature, grant or RLS change.
-- ============================================================================

create or replace function public.admin_adjust_stock(p_variant_id uuid, p_change integer, p_reason text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid        uuid := (select auth.uid());
  v_role       public.app_role := public.current_admin_role();
  v_previous   integer;
  v_new        integer;
  v_product_id uuid;
  v_label      text;
  v_name       text;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if v_role is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  -- S10: audited stock-writer flag (admits this RPC past the guard below).
  perform set_config('kabia.allow_stock_write', 'on', true);

  if p_change is null or p_change = 0 then
    raise exception 'Stok değişimi sıfır olamaz.' using errcode = 'check_violation';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Stok düzeltmesi için gerekçe zorunludur.' using errcode = 'check_violation';
  end if;

  select pv.stock_quantity, pv.product_id, pv.label
  into v_previous, v_product_id, v_label
  from public.product_variants pv
  where pv.id = p_variant_id
  for update;

  if not found then
    raise exception 'Ürün seçeneği bulunamadı.' using errcode = 'no_data_found';
  end if;

  v_new := v_previous + p_change;

  if v_new < 0 then
    raise exception 'Stok negatife düşemez. Mevcut stok: %, istenen değişim: %', v_previous, p_change
      using errcode = 'check_violation';
  end if;

  update public.product_variants
  set stock_quantity = v_new
  where id = p_variant_id;

  select p.name into v_name from public.products p where p.id = v_product_id;

  insert into public.inventory_adjustments (
    variant_id, product_id, admin_user_id, change_quantity,
    previous_quantity, new_quantity, reason, note
  )
  values (
    p_variant_id, v_product_id, v_uid, p_change,
    v_previous, v_new, btrim(p_reason), nullif(btrim(coalesce(p_note, '')), '')
  );

  perform public.log_admin_action(
    'inventory.adjust',
    'product_variant',
    p_variant_id::text,
    jsonb_build_object('stock_quantity', v_previous),
    jsonb_build_object('stock_quantity', v_new),
    jsonb_build_object(
      'product_id', v_product_id,
      'product_name', v_name,
      'variant_label', v_label,
      'change', p_change,
      'reason', btrim(p_reason),
      'note', nullif(btrim(coalesce(p_note, '')), '')
    )
  );

  return jsonb_build_object(
    'variant_id', p_variant_id,
    'previous_quantity', v_previous,
    'new_quantity', v_new,
    'change', p_change
  );
end;
$function$;

create or replace function public.guard_variant_stock()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  if current_setting('kabia.allow_stock_write', true) = 'on' then
    return new;
  end if;
  if new.stock_quantity is distinct from old.stock_quantity then
    raise exception 'Stok yalnızca denetimli stok işlemiyle değiştirilebilir.'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_variants_stock_guard on public.product_variants;
create trigger trg_variants_stock_guard
before update of stock_quantity on public.product_variants
for each row
execute function public.guard_variant_stock();

revoke execute on function public.guard_variant_stock()
  from public, anon, authenticated;
