-- ============================================================================
-- Checkout offers cash on delivery only: create_order rejects anything else.
--
-- WHAT:
--   * public.create_order keeps its 10-parameter signature (p_card_* and
--     p_email stay so deployed clients keep binding), but the body now
--     accepts ONLY p_payment_method = 'cod' (22023 otherwise) and always
--     writes the cod snapshot. The card snapshot branch is gone.
--   * p_card_* shape checks stay as defense-in-depth; with method=cod the
--     checkout sends them null.
--   * Auth-e-mail single source, consents, stock, numbering: unchanged from
--     20260927000700_create_order_auth_email_source.sql (this body is that
--     file with the two payment lines changed).
--
-- WHY: there is no payment-provider integration, so a card checkout took no
--   money while looking like it did. Until a provider is integrated the
--   storefront offers only cash on delivery; the server must reject anything
--   else so a crafted RPC call cannot create a card-labelled order either.
--
-- IDEMPOTENT: CREATE OR REPLACE + repeatable grants/revokes. Re-running
--   changes nothing.
--
-- ROLLBACK: re-apply
--   supabase/migrations/20260927000700_create_order_auth_email_source.sql
--   (restores the card/cod whitelist and the card snapshot branch).
--   Columns/rows are untouched, so rollback is body-only.
--
-- BACKWARD COMPAT: same name, same 10 params in name/type/order/default;
--   deployed 10-key payloads bind identically. Card payloads now fail closed
--   with 'Geçersiz ödeme yöntemi.' (22023), an errcode the client already
--   handles generically.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_order(p_shipping_address jsonb, p_payment_method text, p_consented_sales boolean, p_consented_kvkk boolean, p_card_last4 text DEFAULT NULL::text, p_card_brand text DEFAULT NULL::text, p_card_expiry text DEFAULT NULL::text, p_card_name text DEFAULT NULL::text, p_full_name text DEFAULT NULL::text, p_email text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_cart record;
  v_order_id uuid;
  v_order_number text;
  v_subtotal numeric(10,2) := 0;
  v_shipping numeric(10,2);
  v_total numeric(10,2);
  v_item record;
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
  -- Single source of truth: the confirmed Supabase Auth e-mail. p_email is
  -- accepted for backward compatibility but never stored.
  v_email text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  -- Phase 2: both consents are mandatory and must be true; the server records the time.
  if p_consented_sales is not true or p_consented_kvkk is not true then raise exception 'Siparişi tamamlamak için satış sözleşmesi ve KVKK onayı gerekli.' using errcode = '22023'; end if;
  -- Single source: snapshot the confirmed Auth address. The checkout form
  -- value (p_email) is ignored so an unconfirmed typed address can never
  -- enter orders.email. admin_create_order already snapshots au.email.
  select au.email into v_email from auth.users au where au.id = v_uid;
  if v_email is null or btrim(v_email) = '' then raise exception 'E-posta adresi bulunamadı.' using errcode = '22023'; end if;
  if char_length(v_email) > 254 then raise exception 'E-posta adresi çok uzun.' using errcode = '22023'; end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Geçersiz e-posta adresi.' using errcode = '22023'; end if;
  perform set_config('kabia.allow_stock_write', 'on', true);
  if not public.setting_bool_privileged('checkout_enabled', true) then raise exception 'Şu anda sipariş alınamıyor.'; end if;
  if not public.setting_bool_privileged('store_open', true) then raise exception 'Mağaza şu anda siparişe kapalı.'; end if;
  if p_payment_method is distinct from 'cod' then raise exception 'Geçersiz ödeme yöntemi.' using errcode = '22023'; end if;
  if p_card_last4 is not null and p_card_last4 !~ '^[0-9]{4}$' then raise exception 'Geçersiz kart bilgisi.' using errcode = '22023'; end if;
  if p_card_brand is not null and p_card_brand not in ('visa', 'mastercard', 'troy') then raise exception 'Geçersiz kart bilgisi.' using errcode = '22023'; end if;
  if p_card_expiry is not null and p_card_expiry !~ '^(0[1-9]|1[0-2])/[0-9]{2}$' then raise exception 'Geçersiz kart bilgisi.' using errcode = '22023'; end if;
  if p_card_name is not null and char_length(p_card_name) > 120 then raise exception 'Kart üzerindeki isim çok uzun.' using errcode = '22023'; end if;
  if p_full_name is not null and char_length(p_full_name) > 160 then raise exception 'İsim çok uzun.' using errcode = '22023'; end if;
  v_addr := coalesce(p_shipping_address, '{}'::jsonb);
  if jsonb_typeof(v_addr) <> 'object' or v_addr = '{}'::jsonb then raise exception 'Teslimat adresi eksik.' using errcode = '22023'; end if;
  if char_length(coalesce(v_addr ->> 'addressLine1', '')) < 4 then raise exception 'Teslimat adresi eksik.' using errcode = '22023'; end if;
  if char_length(coalesce(v_addr ->> 'city', '')) < 2 then raise exception 'Teslimat adresi eksik.' using errcode = '22023'; end if;
  if char_length(coalesce(v_addr ->> 'district', '')) < 2 then raise exception 'Teslimat adresi eksik.' using errcode = '22023'; end if;
  if char_length(coalesce(v_addr ->> 'phone', '')) < 7 then raise exception 'Teslimat adresi eksik.' using errcode = '22023'; end if;
  v_clean_addr := jsonb_build_object('label', left(coalesce(v_addr ->> 'label', ''), 80), 'recipientName', left(coalesce(v_addr ->> 'recipientName', ''), 160), 'phone', left(coalesce(v_addr ->> 'phone', ''), 32), 'addressLine1', left(coalesce(v_addr ->> 'addressLine1', ''), 500), 'addressLine2', left(coalesce(v_addr ->> 'addressLine2', ''), 500), 'city', left(coalesce(v_addr ->> 'city', ''), 80), 'district', left(coalesce(v_addr ->> 'district', ''), 80), 'postalCode', left(coalesce(v_addr ->> 'postalCode', ''), 20));
  select c.* into v_cart from public.carts c where c.user_id = v_uid for update;
  if not found then raise exception 'Cart not found'; end if;
  for v_item in select ci.cart_id, ci.product_id, ci.variant_id, ci.quantity, pv.product_id as variant_product_id, pv.price, pv.label, pv.stock_quantity, p.name, p.slug, p.main_image_url, p.is_active from public.cart_items ci join public.product_variants pv on pv.id = ci.variant_id join public.products p on p.id = pv.product_id where ci.cart_id = v_cart.id for update of ci, pv, p
  loop
    if v_item.variant_product_id is distinct from v_item.product_id then raise exception 'Sepet tutarsız, lütfen sepeti yenileyin.' using errcode = '23000'; end if;
    if v_item.quantity < 1 or v_item.quantity > 99 then raise exception 'Geçersiz ürün adedi.' using errcode = '22023'; end if;
    if not v_item.is_active then raise exception 'Product % is no longer available', v_item.name; end if;
    if v_item.stock_quantity < v_item.quantity then raise exception 'Insufficient stock for %', v_item.name; end if;
    update public.product_variants set stock_quantity = stock_quantity - v_item.quantity where id = v_item.variant_id and stock_quantity >= v_item.quantity returning stock_quantity into v_new_stock;
    if not found then raise exception 'Insufficient stock for %', v_item.name; end if;
    insert into public.inventory_adjustments (variant_id, product_id, admin_user_id, change_quantity, previous_quantity, new_quantity, reason, note) values (v_item.variant_id, v_item.variant_product_id, v_uid, -v_item.quantity, v_new_stock + v_item.quantity, v_new_stock, 'order.commit', null);
    v_line_total := v_item.price * v_item.quantity;
    v_subtotal := v_subtotal + v_line_total;
  end loop;
  if v_subtotal = 0 then raise exception 'Cart is empty'; end if;
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
  v_payment := jsonb_build_object('method','cod','label','Kapıda Ödeme');
  insert into public.orders (user_id, order_number, status, subtotal, shipping_cost, total, shipping_address, payment_method_snapshot, full_name, email, stock_committed, consented_sales, consented_kvkk, consented_at) values (v_uid, v_order_number, 'hazirlaniyor', v_subtotal, v_shipping, v_total, v_clean_addr, v_payment, p_full_name, v_email, true, true, true, now()) returning id, order_number into v_order_id, v_order_number;
  for v_item in select ci.product_id, ci.variant_id, ci.quantity, pv.price, pv.label, p.name, p.slug, p.main_image_url from public.cart_items ci join public.product_variants pv on pv.id = ci.variant_id and pv.product_id = ci.product_id join public.products p on p.id = pv.product_id where ci.cart_id = v_cart.id
  loop
    v_line_total := v_item.price * v_item.quantity;
    insert into public.order_items (order_id, product_id, variant_id, product_name_snapshot, variant_label_snapshot, product_slug_snapshot, product_image_snapshot, unit_price_snapshot, quantity, line_total) values (v_order_id, v_item.product_id, v_item.variant_id, v_item.name, v_item.label, v_item.slug, v_item.main_image_url, v_item.price, v_item.quantity, v_line_total);
  end loop;
  insert into public.order_status_history (order_id, status) values (v_order_id, 'hazirlaniyor');
  delete from public.cart_items where cart_id = v_cart.id;
  return jsonb_build_object('order_id', v_order_id, 'order_number', v_order_number, 'subtotal', v_subtotal, 'shipping_cost', v_shipping, 'total', v_total, 'status', 'hazirlaniyor');
end;
$function$;

revoke all on function public.create_order(jsonb, text, boolean, boolean, text, text, text, text, text, text) from public, anon;
grant execute on function public.create_order(jsonb, text, boolean, boolean, text, text, text, text, text, text) to authenticated, service_role;

notify pgrst, 'reload schema';
