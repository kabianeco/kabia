-- BASELINE (reconstructed) — see 20260730194034_create_schema.sql for context.
-- The checkout path. Reproduced verbatim from the live database; the admin work
-- does not modify it.
--
-- Note for the admin dashboard: this function validates stock but never
-- decrements it. Stock movement is therefore an inventory-screen concern only,
-- and cancelling an order does not restock. See docs/admin-architecture.md §15.

create or replace function public.create_order(
  p_shipping_address jsonb,
  p_payment_method text,
  p_card_last4 text default null,
  p_card_brand text default null,
  p_card_expiry text default null,
  p_card_name text default null,
  p_full_name text default null,
  p_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
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
  v_try int := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select c.* into v_cart
  from public.carts c
  where c.user_id = v_uid
  for update;

  if not found then
    raise exception 'Cart not found';
  end if;

  for v_item in
    select ci.cart_id, ci.product_id, ci.variant_id, ci.quantity,
           pv.price, pv.label, pv.stock_quantity,
           p.name, p.slug, p.main_image_url, p.is_active
    from public.cart_items ci
    join public.product_variants pv on pv.id = ci.variant_id
    join public.products p on p.id = ci.product_id
    where ci.cart_id = v_cart.id
    for update of ci, pv, p
  loop
    if not v_item.is_active then
      raise exception 'Product % is no longer available', v_item.name;
    end if;
    if v_item.stock_quantity < v_item.quantity then
      raise exception 'Insufficient stock for %', v_item.name;
    end if;
    v_line_total := v_item.price * v_item.quantity;
    v_subtotal := v_subtotal + v_line_total;
  end loop;

  if v_subtotal = 0 then
    raise exception 'Cart is empty';
  end if;

  v_shipping := case when v_subtotal >= 500 then 0 else 29.90 end;
  v_total := v_subtotal + v_shipping;

  loop
    v_code := '';
    for v_try in 0..6 loop
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    end loop;
    v_order_number := 'KB-' || v_code;
    exit when not exists (select 1 from public.orders where order_number = v_order_number);
    v_try := v_try + 1;
    if v_try > 10 then exit; end if;
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
    shipping_address, payment_method_snapshot, full_name, email)
  values (v_uid, v_order_number, 'hazirlaniyor', v_subtotal, v_shipping, v_total,
    p_shipping_address, v_payment, p_full_name, p_email)
  returning id, order_number into v_order_id, v_order_number;

  for v_item in
    select ci.product_id, ci.variant_id, ci.quantity,
           pv.price, pv.label, p.name, p.slug, p.main_image_url
    from public.cart_items ci
    join public.product_variants pv on pv.id = ci.variant_id
    join public.products p on p.id = ci.product_id
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
$$;
