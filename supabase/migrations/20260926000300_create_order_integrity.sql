-- ============================================================================
-- S1 (coherence) + S2 (decrement) + S4 (server validation + consent) +
-- S5 (store_open gate) + S6 (order-number counter) + S12 (privileged readers):
-- order-creation integrity rewrite of public.create_order.
--
-- WHAT:
--   * New columns on orders (all optional, backward compatible):
--       stock_committed boolean NOT NULL DEFAULT false (S2)
--       consented_sales / consented_kvkk boolean NULL (S4)
--       consented_at timestamptz NULL (S4)
--   * create_order rewritten (same name, same first 8 params, 2 new optional
--     params with defaults):
--       - S1: items joined variant->own product (pv.product_id = ci.product_id
--         in the second loop; explicit mismatch raise in the first); is_active
--         checked on the variant's OWN product; name/slug/image snapshotted
--         from that product.
--       - S2: stock decremented atomically under the existing FOR UPDATE row
--         locks (UPDATE ... WHERE stock_quantity >= qty, abort if no row);
--         every movement recorded in inventory_adjustments (reason
--         'order.commit', actor = ordering customer); orders.stock_committed
--         set true. Pre-decrement orders keep stock_committed = false so the
--         cancel-restock path never touches them.
--       - S3: per-line quantity must be 1..99 (matches the cart_items CHECK).
--       - S4: p_payment_method whitelisted to ('card','cod'); card display
--         fields shape-checked when present; full_name/email length-bounded,
--         email shape-checked when non-empty; address snapshot must be a
--         non-empty object with addressLine1/city/district/phone minima and
--         length caps, unknown keys stripped before storage; consent params
--         recorded with server clock when present (still OPTIONAL — deployed
--         production code does not send them; they must become required after
--         this branch deploys, see FINAL REPORT).
--       - S5: store_open false rejects new orders (privileged reader).
--       - S6: separate v_attempts counter, cap 10 -> Turkish error.
--       - S12: shipping keys read through setting_number_privileged with
--         defaults matching live values (2000 / 0).
--   * perform set_config('kabia.allow_stock_write','on',true) up front: the
--     S10 stock guard (separate migration) admits only flagged writers; the
--     flag is a no-op until that trigger lands.
--   * search_path widened to 'public','pg_temp' (hardening, no behavior change).
--
-- ROLLBACK: restore the previous function body from
-- db-snapshots/20260925T2344-create_order-def.sql; drop the added columns
-- only if no order rows use them (columns are nullable/defaulted, so keeping
-- them is also safe).
--
-- BACKWARD COMPATIBILITY: the first 8 params are unchanged in name, type,
-- order and default; new params default null so the deployed client's 8-key
-- payload binds identically. No column the deployed code uses is removed or
-- renamed. Validation mirrors the shipped client's own minima, and every
-- rejection uses an errcode the client already surfaces generically. Live
-- site_settings keys exist, so privileged reads return live values.
-- The old 8-parameter overload is dropped in the same migration (pre-approved
-- DROP-when-replacing): PostgREST binds by supplied keys, so after the drop
-- an 8-key call resolves to this body with the new params defaulted — no
-- caller can reach the vulnerable body anymore.
-- ============================================================================

alter table public.orders
  add column if not exists stock_committed boolean not null default false;
alter table public.orders
  add column if not exists consented_sales boolean;
alter table public.orders
  add column if not exists consented_kvkk boolean;
alter table public.orders
  add column if not exists consented_at timestamptz;

-- The previous 8-parameter overload is dropped so EVERY caller — deployed or
-- new — binds to the hardened 10-parameter body below (new params default
-- null, so an 8-key payload behaves as before minus the closed holes).
-- Allowed: DROP FUNCTION when immediately replacing the object (§4).
drop function if exists
  public.create_order(jsonb, text, text, text, text, text, text, text);

create or replace function public.create_order(
  p_shipping_address jsonb,
  p_payment_method text,
  p_card_last4 text default null,
  p_card_brand text default null,
  p_card_expiry text default null,
  p_card_name text default null,
  p_full_name text default null,
  p_email text default null,
  p_consented_sales boolean default null,
  p_consented_kvkk boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
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
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- S10-forward: audited stock writer flag (no-op until the guard lands).
  perform set_config('kabia.allow_stock_write', 'on', true);

  -- S5+S12: kill switches through the privileged readers (sensitive keys).
  if not public.setting_bool_privileged('checkout_enabled', true) then
    raise exception 'Şu anda sipariş alınamıyor.';
  end if;
  if not public.setting_bool_privileged('store_open', true) then
    raise exception 'Mağaza şu anda siparişe kapalı.';
  end if;

  -- S4: payment method whitelist. Prices and totals stay server-side.
  if p_payment_method is distinct from 'card'
     and p_payment_method is distinct from 'cod' then
    raise exception 'Geçersiz ödeme yöntemi.' using errcode = '22023';
  end if;
  if p_card_last4 is not null and p_card_last4 !~ '^[0-9]{4}$' then
    raise exception 'Geçersiz kart bilgisi.' using errcode = '22023';
  end if;
  if p_card_brand is not null
     and p_card_brand not in ('visa', 'mastercard', 'troy') then
    raise exception 'Geçersiz kart bilgisi.' using errcode = '22023';
  end if;
  if p_card_expiry is not null
     and p_card_expiry !~ '^(0[1-9]|1[0-2])/[0-9]{2}$' then
    raise exception 'Geçersiz kart bilgisi.' using errcode = '22023';
  end if;
  if p_card_name is not null and char_length(p_card_name) > 120 then
    raise exception 'Kart üzerindeki isim çok uzun.' using errcode = '22023';
  end if;
  if p_full_name is not null and char_length(p_full_name) > 160 then
    raise exception 'İsim çok uzun.' using errcode = '22023';
  end if;
  if p_email is not null and char_length(p_email) > 254 then
    raise exception 'E-posta adresi çok uzun.' using errcode = '22023';
  end if;
  if p_email is not null and btrim(p_email) <> ''
     and p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Geçersiz e-posta adresi.' using errcode = '22023';
  end if;

  -- S4: address snapshot shape (mirrors the shipped client's minima).
  v_addr := coalesce(p_shipping_address, '{}'::jsonb);
  if jsonb_typeof(v_addr) <> 'object' or v_addr = '{}'::jsonb then
    raise exception 'Teslimat adresi eksik.' using errcode = '22023';
  end if;
  if char_length(coalesce(v_addr ->> 'addressLine1', '')) < 4 then
    raise exception 'Teslimat adresi eksik.' using errcode = '22023';
  end if;
  if char_length(coalesce(v_addr ->> 'city', '')) < 2 then
    raise exception 'Teslimat adresi eksik.' using errcode = '22023';
  end if;
  if char_length(coalesce(v_addr ->> 'district', '')) < 2 then
    raise exception 'Teslimat adresi eksik.' using errcode = '22023';
  end if;
  if char_length(coalesce(v_addr ->> 'phone', '')) < 7 then
    raise exception 'Teslimat adresi eksik.' using errcode = '22023';
  end if;
  -- Length-bound every stored key; strip anything unknown.
  v_clean_addr := jsonb_build_object(
    'label',         left(coalesce(v_addr ->> 'label', ''), 80),
    'recipientName', left(coalesce(v_addr ->> 'recipientName', ''), 160),
    'phone',         left(coalesce(v_addr ->> 'phone', ''), 32),
    'addressLine1',  left(coalesce(v_addr ->> 'addressLine1', ''), 500),
    'addressLine2',  left(coalesce(v_addr ->> 'addressLine2', ''), 500),
    'city',          left(coalesce(v_addr ->> 'city', ''), 80),
    'district',      left(coalesce(v_addr ->> 'district', ''), 80),
    'postalCode',    left(coalesce(v_addr ->> 'postalCode', ''), 20)
  );

  select c.* into v_cart
  from public.carts c
  where c.user_id = v_uid
  for update;

  if not found then
    raise exception 'Cart not found';
  end if;

  for v_item in
    select ci.cart_id, ci.product_id, ci.variant_id, ci.quantity,
           pv.product_id as variant_product_id,
           pv.price, pv.label, pv.stock_quantity,
           p.name, p.slug, p.main_image_url, p.is_active
    from public.cart_items ci
    join public.product_variants pv on pv.id = ci.variant_id
    join public.products p on p.id = pv.product_id
    where ci.cart_id = v_cart.id
    for update of ci, pv, p
  loop
    -- S1: belt-and-braces coherence (the composite FK already forbids rows
    -- the check rejects; this fails loudly instead of mispricing).
    if v_item.variant_product_id is distinct from v_item.product_id then
      raise exception 'Sepet tutarsız, lütfen sepeti yenileyin.'
        using errcode = '23000';
    end if;
    -- S3: server-side quantity bound (matches the cart_items CHECK).
    if v_item.quantity < 1 or v_item.quantity > 99 then
      raise exception 'Geçersiz ürün adedi.' using errcode = '22023';
    end if;
    -- S1 availability: is_active of the variant's OWN product.
    if not v_item.is_active then
      raise exception 'Product % is no longer available', v_item.name;
    end if;
    if v_item.stock_quantity < v_item.quantity then
      raise exception 'Insufficient stock for %', v_item.name;
    end if;
    -- S2: atomic decrement under the row lock; abort if the guarded
    -- write finds no row (lost race instead of oversell).
    update public.product_variants
    set stock_quantity = stock_quantity - v_item.quantity
    where id = v_item.variant_id
      and stock_quantity >= v_item.quantity
    returning stock_quantity into v_new_stock;
    if not found then
      raise exception 'Insufficient stock for %', v_item.name;
    end if;
    insert into public.inventory_adjustments
      (variant_id, product_id, admin_user_id, change_quantity,
       previous_quantity, new_quantity, reason, note)
    values
      (v_item.variant_id, v_item.variant_product_id, v_uid,
       -v_item.quantity, v_new_stock + v_item.quantity, v_new_stock,
       'order.commit', null);
    v_line_total := v_item.price * v_item.quantity;
    v_subtotal := v_subtotal + v_line_total;
  end loop;

  if v_subtotal = 0 then
    raise exception 'Cart is empty';
  end if;

  -- S12: shipping through the privileged readers (live values 2000 / 0).
  v_free_threshold := public.setting_number_privileged('free_shipping_threshold', 2000);
  v_flat_rate      := public.setting_number_privileged('shipping_flat_rate', 0);
  v_shipping := case when v_subtotal >= v_free_threshold then 0 else v_flat_rate end;
  v_total := v_subtotal + v_shipping;

  -- S6: dedicated attempts counter (v_try reuse removed); cap fires.
  loop
    v_code := '';
    for v_i in 1..7 loop
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    end loop;
    v_attempts := v_attempts + 1;
    v_order_number := 'KB-' || v_code;
    exit when not exists (select 1 from public.orders where order_number = v_order_number);
    if v_attempts >= 10 then
      raise exception 'Sipariş numarası üretilemedi, lütfen tekrar deneyin.'
        using errcode = '23505';
    end if;
  end loop;

  if p_payment_method = 'cod' then
    v_payment := jsonb_build_object('method','cod','label','Kapıda Ödeme');
  else
    v_payment := jsonb_build_object(
      'method','card',
      'last4', p_card_last4,
      'brand', p_card_brand,
      'expiry', p_card_expiry,
      'card_name', p_card_name,
      'label', '•••• •••• •••• ' || coalesce(p_card_last4, '••••')
    );
  end if;

  insert into public.orders (user_id, order_number, status, subtotal, shipping_cost, total,
    shipping_address, payment_method_snapshot, full_name, email,
    stock_committed, consented_sales, consented_kvkk, consented_at)
  values (v_uid, v_order_number, 'hazirlaniyor', v_subtotal, v_shipping, v_total,
    v_clean_addr, v_payment, p_full_name, p_email,
    true, p_consented_sales, p_consented_kvkk,
    case when p_consented_sales is not null or p_consented_kvkk is not null
         then now() else null end)
  returning id, order_number into v_order_id, v_order_number;

  for v_item in
    select ci.product_id, ci.variant_id, ci.quantity,
           pv.price, pv.label, p.name, p.slug, p.main_image_url
    from public.cart_items ci
    join public.product_variants pv
      on pv.id = ci.variant_id and pv.product_id = ci.product_id
    join public.products p on p.id = pv.product_id
    where ci.cart_id = v_cart.id
  loop
    v_line_total := v_item.price * v_item.quantity;
    insert into public.order_items (order_id, product_id, variant_id,
      product_name_snapshot, variant_label_snapshot, product_slug_snapshot, product_image_snapshot,
      unit_price_snapshot, quantity, line_total)
    values (v_order_id, v_item.product_id, v_item.variant_id,
      v_item.name, v_item.label, v_item.slug, v_item.main_image_url,
      v_item.price, v_item.quantity, v_line_total);
  end loop;

  insert into public.order_status_history (order_id, status)
  values (v_order_id, 'hazirlaniyor');

  delete from public.cart_items where cart_id = v_cart.id;

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
