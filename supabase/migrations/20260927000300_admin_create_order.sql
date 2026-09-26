-- ============================================================================
-- FEATURE 2 — yöneticinin müşteri adına sipariş oluşturması (admin_create_order)
--
-- WHAT:
--   * orders'a dört sütun: admin_created_by (uuid, hangi yönetici),
--     admin_created_at (timestamptz, ne zaman), admin_note (text, iç not),
--     consent_note (text, sözlü/kayıtlı onayın açık ifadesi).
--   * public.admin_create_order(p_customer_id, p_items, p_shipping_address,
--     p_payment_method, p_admin_note, p_consent_note): SECURITY DEFINER RPC.
--     Gövde içinde has_admin_role() yeniden denetlenir (RLS tek başına
--     yeterli sayılmaz). create_order mantığını yeniden kullanır:
--     stok denetimi + atomik düşüm (stock_quantity >= adet korumalı),
--     stock_committed=true, KB-XXXXXXX sipariş numarası, fiyatlar yalnızca
--     product_variants'tan (formdan fiyat alınmaz), kargo eşiği privileged
--     reader'dan, order_items snapshot'ları, durum geçmişi satırı,
--     inventory_adjustments 'order.commit' kaydı.
--   * Ödeme: yalnızca 'cod' (Kapıda Ödeme) ve 'bank_transfer' (Havale / EFT).
--     Kart alınmaz.
--   * Onam: müşterinin kutucukları taklit edilmez — consented_sales/kvkk
--     false, consented_at null yazılır; p_consent_note (zorunlu, 3..500
--     karakter) consent_note sütununa ve bir order_notes satırına açık
--     ifadeyle kaydedilir (örn. "Telefonda sözlü onay alındı").
--
-- WHY: telefonda / yüz yüze siparişler; fiyat ve stok yetkisi veritabanında.
--
-- ROLLBACK: drop function if exists public.admin_create_order(...);
-- (sütunlar veri kaybı olmaması için bırakılır.)
--
-- BACKWARD COMPAT: mevcut create_order ve durum RPC'leri değişmedi.
-- ============================================================================

alter table public.orders add column if not exists admin_created_by uuid;
alter table public.orders add column if not exists admin_created_at timestamptz;
alter table public.orders add column if not exists admin_note text;
alter table public.orders add column if not exists consent_note text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_admin_note_len') then
    alter table public.orders add constraint orders_admin_note_len
      check (admin_note is null or char_length(admin_note) between 1 and 2000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_consent_note_len') then
    alter table public.orders add constraint orders_consent_note_len
      check (consent_note is null or char_length(consent_note) between 3 and 500);
  end if;
end $$;

create or replace function public.admin_create_order(
  p_customer_id uuid,
  p_items jsonb,
  p_shipping_address jsonb,
  p_payment_method text,
  p_admin_note text default null,
  p_consent_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_order_id uuid;
  v_order_number text;
  v_subtotal numeric(10,2) := 0;
  v_shipping numeric(10,2);
  v_total numeric(10,2);
  v_variant record;
  v_line_total numeric(10,2);
  v_payment jsonb;
  v_code text;
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_i int;
  v_attempts int := 0;
  v_free_threshold numeric(10,2);
  v_flat_rate numeric(10,2);
  v_addr jsonb;
  v_clean_addr jsonb;
  v_new_stock integer;
  v_admin_note text := nullif(btrim(coalesce(p_admin_note, '')), '');
  v_consent text := btrim(coalesce(p_consent_note, ''));
  v_count int := 0;
  v_len int := 0;
  v_idx int := 0;
  v_el jsonb;
  v_qty int;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  -- Yetki gövde içinde yeniden denetlenir: yalnızca yöneticiler.
  if not public.has_admin_role() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_customer_id is null then
    raise exception 'Müşteri seçilmedi.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_customer_id) then
    raise exception 'Müşteri bulunamadı.' using errcode = 'no_data_found';
  end if;

  -- Onam beyanı zorunlu ve açık: müşterinin kutucuğu taklit edilmez.
  if v_consent = '' then
    raise exception 'Sözlü ya da kayıtlı onayın açık ifadesi gerekli.' using errcode = '23514';
  end if;
  if length(v_consent) > 500 then
    raise exception 'Onam beyanı çok uzun.' using errcode = '22023';
  end if;
  if v_admin_note is not null and length(v_admin_note) > 2000 then
    raise exception 'İç not çok uzun.' using errcode = '22023';
  end if;

  if p_payment_method is distinct from 'cod' and p_payment_method is distinct from 'bank_transfer' then
    raise exception 'Geçersiz ödeme yöntemi.' using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_items, 'null'::jsonb)) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Sipariş kalemi yok.' using errcode = '22023';
  end if;

  -- Adres doğrulama create_order ile aynı.
  v_addr := coalesce(p_shipping_address, '{}'::jsonb);
  if jsonb_typeof(v_addr) <> 'object' or v_addr = '{}'::jsonb then raise exception 'Teslimat adresi eksik.' using errcode = '22023'; end if;
  if char_length(coalesce(v_addr ->> 'addressLine1', '')) < 4 then raise exception 'Teslimat adresi eksik.' using errcode = '22023'; end if;
  if char_length(coalesce(v_addr ->> 'city', '')) < 2 then raise exception 'Teslimat adresi eksik.' using errcode = '22023'; end if;
  if char_length(coalesce(v_addr ->> 'district', '')) < 2 then raise exception 'Teslimat adresi eksik.' using errcode = '22023'; end if;
  if char_length(coalesce(v_addr ->> 'phone', '')) < 7 then raise exception 'Teslimat adresi eksik.' using errcode = '22023'; end if;
  v_clean_addr := jsonb_build_object('label', left(coalesce(v_addr ->> 'label', ''), 80), 'recipientName', left(coalesce(v_addr ->> 'recipientName', ''), 160), 'phone', left(coalesce(v_addr ->> 'phone', ''), 32), 'addressLine1', left(coalesce(v_addr ->> 'addressLine1', ''), 500), 'addressLine2', left(coalesce(v_addr ->> 'addressLine2', ''), 500), 'city', left(coalesce(v_addr ->> 'city', ''), 80), 'district', left(coalesce(v_addr ->> 'district', ''), 80), 'postalCode', left(coalesce(v_addr ->> 'postalCode', ''), 20));

  perform set_config('kabia.allow_order_write', 'on', true);
  perform set_config('kabia.allow_stock_write', 'on', true);

  if not public.setting_bool_privileged('checkout_enabled', true) then raise exception 'Şu anda sipariş alınamıyor.'; end if;
  if not public.setting_bool_privileged('store_open', true) then raise exception 'Mağaza şu anda siparişe kapalı.'; end if;

  -- Kalemler: fiyatlar yalnızca veritabanından, stok atomik düşer.
  v_len := jsonb_array_length(p_items);
  for v_idx in 0..v_len - 1 loop
    v_el := p_items -> v_idx;
    if (v_el ->> 'variant_id') is null or (v_el ->> 'quantity') is null then
      raise exception 'Geçersiz ürün adedi.' using errcode = '22023';
    end if;
    begin
      v_qty := (v_el ->> 'quantity')::int;
    exception when others then
      raise exception 'Geçersiz ürün adedi.' using errcode = '22023';
    end;
    if v_qty < 1 or v_qty > 99 then
      raise exception 'Geçersiz ürün adedi.' using errcode = '22023';
    end if;
    select pv.id as variant_id, pv.product_id, pv.price, pv.label, pv.stock_quantity,
           p.id as pid, p.name, p.slug, p.main_image_url, p.is_active
      into v_variant
      from public.product_variants pv
      join public.products p on p.id = pv.product_id
      where pv.id = (v_el ->> 'variant_id')::uuid
      for update of pv, p;
    if not found then
      raise exception 'Ürün bulunamadı.' using errcode = 'no_data_found';
    end if;
    if not v_variant.is_active then
      raise exception 'Product % is no longer available', v_variant.name;
    end if;
    if v_variant.stock_quantity < v_qty then
      raise exception 'Insufficient stock for %', v_variant.name;
    end if;
    update public.product_variants
      set stock_quantity = stock_quantity - v_qty
      where id = v_variant.variant_id and stock_quantity >= v_qty
      returning stock_quantity into v_new_stock;
    if not found then
      raise exception 'Insufficient stock for %', v_variant.name;
    end if;
    insert into public.inventory_adjustments (variant_id, product_id, admin_user_id, change_quantity, previous_quantity, new_quantity, reason, note)
    values (v_variant.variant_id, v_variant.product_id, v_uid, -(v_qty), v_new_stock + v_qty, v_new_stock, 'order.commit', null);
    v_line_total := v_variant.price * v_qty;
    v_subtotal := v_subtotal + v_line_total;
    v_count := v_count + 1;
  end loop;

  if v_subtotal = 0 then raise exception 'Sipariş kalemi yok.'; end if;

  v_free_threshold := public.setting_number_privileged('free_shipping_threshold', 2000);
  v_flat_rate := public.setting_number_privileged('shipping_flat_rate', 0);
  v_shipping := case when v_subtotal >= v_free_threshold then 0 else v_flat_rate end;
  v_total := v_subtotal + v_shipping;

  loop
    v_code := '';
    for v_i in 1..7 loop v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1); end loop;
    v_attempts := v_attempts + 1;
    v_order_number := 'KB-' || v_code;
    exit when not exists (select 1 from public.orders where order_number = v_order_number);
    if v_attempts >= 10 then raise exception 'Sipariş numarası üretilemedi, lütfen tekrar deneyin.' using errcode = '23505'; end if;
  end loop;

  if p_payment_method = 'cod' then
    v_payment := jsonb_build_object('method', 'cod', 'label', 'Kapıda Ödeme');
  else
    v_payment := jsonb_build_object('method', 'bank_transfer', 'label', 'Havale / EFT');
  end if;

  insert into public.orders (user_id, order_number, status, subtotal, shipping_cost, total,
      shipping_address, payment_method_snapshot, full_name, email,
      stock_committed, consented_sales, consented_kvkk, consented_at,
      admin_created_by, admin_created_at, admin_note, consent_note)
  select p_customer_id, v_order_number, 'hazirlaniyor', v_subtotal, v_shipping, v_total,
      v_clean_addr, v_payment, pr.full_name, au.email,
      true, false, false, null,
      v_uid, now(), v_admin_note, v_consent
    from public.profiles pr
    left join auth.users au on au.id = pr.id
    where pr.id = p_customer_id
  returning id, order_number into v_order_id, v_order_number;

  for v_idx in 0..v_len - 1 loop
    v_el := p_items -> v_idx;
    v_qty := (v_el ->> 'quantity')::int;
    select pv.price, pv.label, p.name, p.slug, p.main_image_url, pv.product_id
      into v_variant
      from public.product_variants pv
      join public.products p on p.id = pv.product_id
      where pv.id = (v_el ->> 'variant_id')::uuid;
    v_line_total := v_variant.price * v_qty;
    insert into public.order_items (order_id, product_id, variant_id,
        product_name_snapshot, variant_label_snapshot, product_slug_snapshot, product_image_snapshot,
        unit_price_snapshot, quantity, line_total)
    values (v_order_id, v_variant.product_id, (v_el ->> 'variant_id')::uuid,
        v_variant.name, v_variant.label, v_variant.slug, v_variant.main_image_url,
        v_variant.price, v_qty, v_line_total);
  end loop;

  insert into public.order_status_history (order_id, status)
  values (v_order_id, 'hazirlaniyor');

  insert into public.order_notes (order_id, admin_user_id, note)
  values (v_order_id, v_uid, 'YÖNETİCİ OLUŞTURDU — onam: ' || v_consent);
  if v_admin_note is not null then
    insert into public.order_notes (order_id, admin_user_id, note)
    values (v_order_id, v_uid, v_admin_note);
  end if;

  perform public.log_admin_action(
    'order.admin_create',
    'order',
    v_order_id::text,
    null,
    jsonb_build_object('status', 'hazirlaniyor', 'total', v_total),
    jsonb_build_object('order_number', v_order_number, 'customer_id', p_customer_id,
      'payment_method', p_payment_method, 'item_count', v_count,
      'consent_note', v_consent, 'admin_note_present', v_admin_note is not null)
  );

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'subtotal', v_subtotal,
    'shipping_cost', v_shipping,
    'total', v_total,
    'status', 'hazirlaniyor'
  );
end;
$function$;

revoke execute on function public.admin_create_order(uuid, jsonb, jsonb, text, text, text) from public, anon;
grant execute on function public.admin_create_order(uuid, jsonb, jsonb, text, text, text) to authenticated, service_role;
