-- ============================================================================
-- BUG 2 — super-admin order status override onarımı
--
-- WHAT: admin_override_order_status içindeki
--   ALTER TABLE orders DISABLE TRIGGER enforce_order_status_transition
-- ifadesi yanlış tetikleyici adını kullanıyordu; canlıdaki tetikleyici
-- trg_orders_status_transition. Bu yüzden her override
--   42704: trigger "enforce_order_status_transition" does not exist
-- hatasıyla düşüyordu. DDL ile tetikleyici kapatmak yerine işlem-yerel
-- (transaction-local) bayrak desenine geçildi:
--   * enforce_order_status_transition() en başta
--     current_setting('kabia.allow_status_override', true) = 'on' ise
--     geçişi koşulsuz kabul eder (yalnızca override RPC bu bayrağı kurar).
--   * admin_override_order_status() artık ALTER TABLE yapmaz; bayrağı
--     set_config(..., true) ile kurar, mevcut kabia.allow_order_write /
--     kabia.allow_stock_write bayraklarını korumaya devam eder.
-- Normal yol (admin_update_order_status) bayrağı kurmadığı için matris
-- aynen uygulanır; plain admin override'u is_super_admin() reddeder.
--
-- WHY: canlıda doğrulandı (2026-09-27): super_admin JWT ile override çağrısı
-- 42704 ile düştü; information_schema.triggers gerçek adın
-- trg_orders_status_transition olduğunu gösterdi.
--
-- ROLLBACK: db-snapshots/20260927T0215-bug2-*.sql dosyalarındaki önceki
-- gövdeleri geri yazın (override'ta ALTER TABLE satırları, trigger'da
-- bayrak kontrolü yok).
--
-- BACKWARD COMPAT: imza, grant ve dönüş şekli değişmedi.
-- ============================================================================

-- 1) Geçiş matrisi: override bayrağı varsa denetimi atla.
create or replace function public.enforce_order_status_transition()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  -- Denetimli override yolu (yalnızca admin_override_order_status kurar).
  if current_setting('kabia.allow_status_override', true) = 'on' then
    return new;
  end if;
  if new.status = old.status then return new; end if;
  if ((old.status = 'hazirlaniyor' and new.status in ('kargoda', 'teslim_edildi', 'iptal_edildi')) or (old.status = 'kargoda' and new.status in ('teslim_edildi', 'iptal_edildi'))) then return new; end if;
  raise exception 'Geçersiz durum geçişi.' using errcode = 'check_violation', detail = 'Bu geçişe izin verilmez: ' || old.status::text || ' -> ' || new.status::text, hint = 'Terminal durumdan geri dönüş yapılamaz.';
end;
$function$;

revoke execute on function public.enforce_order_status_transition() from public, anon, authenticated;

-- 2) Override RPC: DDL yerine bayrak.
create or replace function public.admin_override_order_status(p_order_id uuid, p_status order_status, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_previous public.order_status;
  v_number text;
  v_committed boolean := false;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_line record;
  v_restocked integer;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  if not public.is_super_admin() then raise exception 'Bu işlem yalnızca süper yöneticiler için geçerlidir.' using errcode = '42501'; end if;
  if v_reason = '' then raise exception 'Geçersiz durum geçişi için bir gerekçe girilmelidir.' using errcode = '23514'; end if;
  if length(v_reason) > 500 then raise exception 'Gerekçe çok uzun.' using errcode = '22023'; end if;
  perform set_config('kabia.allow_order_write', 'on', true);
  perform set_config('kabia.allow_stock_write', 'on', true);
  -- Matris baypası: yalnızca bu işlem için, işlem-yerel.
  perform set_config('kabia.allow_status_override', 'on', true);
  select o.status, o.order_number, o.stock_committed into v_previous, v_number, v_committed from public.orders o where o.id = p_order_id for update;
  if not found then raise exception 'Sipariş bulunamadı.' using errcode = 'no_data_found'; end if;
  if v_previous = p_status then return jsonb_build_object('order_id', p_order_id, 'order_number', v_number, 'previous_status', v_previous, 'status', p_status, 'override', true, 'idempotent', true); end if;
  update public.orders set status = p_status where id = p_order_id;
  if p_status = 'iptal_edildi' and coalesce(v_committed, false) then
    for v_line in select variant_id, product_id, quantity from public.order_items where order_id = p_order_id loop
      update public.product_variants set stock_quantity = stock_quantity + v_line.quantity where id = v_line.variant_id returning stock_quantity into v_restocked;
      insert into public.inventory_adjustments (variant_id, product_id, admin_user_id, change_quantity, previous_quantity, new_quantity, reason, note) values (v_line.variant_id, v_line.product_id, v_uid, v_line.quantity, v_restocked - v_line.quantity, v_restocked, 'order.cancel', v_number);
    end loop;
    update public.orders set stock_committed = false where id = p_order_id;
  end if;
  insert into public.order_notes (order_id, admin_user_id, note) values (p_order_id, v_uid, 'GEÇERSİZ DURUM GEÇİŞİ: ' || v_reason);
  perform public.log_admin_action('order.status_override', 'order', p_order_id::text, jsonb_build_object('status', v_previous), jsonb_build_object('status', p_status), jsonb_build_object('order_number', v_number, 'override_reason', v_reason));
  return jsonb_build_object('order_id', p_order_id, 'order_number', v_number, 'previous_status', v_previous, 'status', p_status, 'override', true);
end;
$function$;

revoke execute on function public.admin_override_order_status(uuid, order_status, text) from public, anon;
grant execute on function public.admin_override_order_status(uuid, order_status, text) to authenticated, service_role;
