-- ---------------------------------------------------------------------------
-- Store settings and operationally editable content.
--
-- This is a controlled key/value model, not a page builder. The key set is
-- fixed by this migration: there is no INSERT and no DELETE policy, so the
-- dashboard can change a setting's *value* and nothing else. A trigger blocks
-- any attempt to move a key between the public/sensitive classes.
--
-- Two independent flags, because they answer different questions:
--   is_public    — may an anonymous storefront visitor read it? (the store
--                  needs the announcement, contact details, shipping rules and
--                  the open/closed state in order to render correctly)
--   is_sensitive — may only a super_admin change it?
--
-- Rollback: drop the trigger and helper functions, then the table. The
-- create_order() change at the end of this file falls back to the original
-- hard-coded constants if the settings rows are missing, so dropping the table
-- degrades checkout to its previous behaviour rather than breaking it.
-- ---------------------------------------------------------------------------

create table if not exists public.site_settings (
  key          text primary key,
  value        jsonb not null,
  value_type   text not null check (value_type in ('string', 'number', 'boolean')),
  label        text not null,
  group_key    text not null check (group_key in ('general', 'inventory', 'shipping', 'store', 'content', 'seo')),
  is_public    boolean not null default false,
  is_sensitive boolean not null default false,
  updated_at   timestamptz not null default now(),
  updated_by   uuid,
  -- Named distinctly from the column-level check on value_type, whose
  -- auto-generated name is already site_settings_value_type_check.
  constraint site_settings_value_shape_check check (
       (value_type = 'string'  and jsonb_typeof(value) = 'string')
    or (value_type = 'number'  and jsonb_typeof(value) = 'number')
    or (value_type = 'boolean' and jsonb_typeof(value) = 'boolean')
  ),
  -- Values are rendered as text by React, which escapes them. This is defence
  -- in depth against a value ever reaching a raw-HTML sink.
  constraint site_settings_no_script_check check (
    value_type <> 'string'
    or (value #>> '{}') !~* '(<\s*script|javascript\s*:|on[a-z]+\s*=)'
  )
);

comment on table public.site_settings is
  'Fixed-key store configuration. No INSERT/DELETE policy exists: the key set is defined by migration only.';

alter table public.site_settings enable row level security;

drop policy if exists settings_public_read        on public.site_settings;
drop policy if exists settings_admin_read         on public.site_settings;
drop policy if exists settings_admin_update       on public.site_settings;
drop policy if exists settings_super_admin_update on public.site_settings;

create policy settings_public_read on public.site_settings
  for select to anon, authenticated
  using (is_public);

create policy settings_admin_read on public.site_settings
  for select to authenticated
  using (public.has_admin_role());

create policy settings_admin_update on public.site_settings
  for update to authenticated
  using (public.has_admin_role() and not is_sensitive)
  with check (public.has_admin_role() and not is_sensitive);

create policy settings_super_admin_update on public.site_settings
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

revoke all on public.site_settings from anon, authenticated;
grant select on public.site_settings to anon, authenticated;
grant update on public.site_settings to authenticated;

-- Only `value` and `updated_by` may move. Everything else is structure.
create or replace function public.guard_site_settings_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.key          is distinct from old.key
  or new.value_type   is distinct from old.value_type
  or new.label        is distinct from old.label
  or new.group_key    is distinct from old.group_key
  or new.is_public    is distinct from old.is_public
  or new.is_sensitive is distinct from old.is_sensitive then
    raise exception 'Yalnızca ayar değeri güncellenebilir.' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_site_settings_guard on public.site_settings;
create trigger trg_site_settings_guard
before update on public.site_settings
for each row execute function public.guard_site_settings_update();

revoke execute on function public.guard_site_settings_update() from public, anon, authenticated;

-- ---- typed readers ---------------------------------------------------------
-- Used by database logic (checkout). The application reads the table directly
-- through RLS.

create or replace function public.setting_number(p_key text, p_default numeric)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select (s.value #>> '{}')::numeric
     from public.site_settings s
     where s.key = p_key and s.value_type = 'number'),
    p_default
  )
$$;

create or replace function public.setting_bool(p_key text, p_default boolean)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select (s.value #>> '{}')::boolean
     from public.site_settings s
     where s.key = p_key and s.value_type = 'boolean'),
    p_default
  )
$$;

revoke execute on function public.setting_number(text, numeric) from public, anon;
revoke execute on function public.setting_bool(text, boolean)   from public, anon;
grant  execute on function public.setting_number(text, numeric) to authenticated, service_role;
grant  execute on function public.setting_bool(text, boolean)   to authenticated, service_role;

-- ---- the key set -----------------------------------------------------------
-- Seeded from lib/site.ts and from the constants create_order() already used,
-- so installing this migration changes no observable behaviour.

insert into public.site_settings (key, value, value_type, label, group_key, is_public, is_sensitive) values
  ('store_name',                  '"Kabia Ekolojik"'::jsonb,                         'string',  'Mağaza adı',                'general',   true,  false),
  ('support_email',               '"info@kabia.com"'::jsonb,                         'string',  'Destek e-postası',          'general',   true,  false),
  ('support_phone',               '"+90 553 744 76 74"'::jsonb,                      'string',  'Destek telefonu',           'general',   true,  false),
  ('currency',                    '"TRY"'::jsonb,                                    'string',  'Para birimi',               'general',   true,  false),
  ('timezone',                    '"Europe/Istanbul"'::jsonb,                        'string',  'Saat dilimi',               'general',   true,  false),

  ('default_low_stock_threshold', '5'::jsonb,                                        'number',  'Varsayılan kritik stok',    'inventory', false, false),

  ('free_shipping_threshold',     '500'::jsonb,                                      'number',  'Ücretsiz kargo limiti (₺)', 'shipping',  true,  false),
  ('shipping_flat_rate',          '29.90'::jsonb,                                    'number',  'Sabit kargo ücreti (₺)',    'shipping',  true,  false),
  ('shipping_message',            '"500 ₺ ve üzeri siparişlerde kargo ücretsiz."'::jsonb, 'string', 'Kargo mesajı',          'shipping',  true,  false),

  ('store_open',                  'true'::jsonb,                                     'boolean', 'Mağaza açık',               'store',     true,  true),
  ('checkout_enabled',            'true'::jsonb,                                     'boolean', 'Sipariş alımı açık',        'store',     true,  true),
  ('maintenance_message',         '""'::jsonb,                                       'string',  'Bakım mesajı',              'store',     true,  true),

  ('announcement_enabled',        'false'::jsonb,                                    'boolean', 'Duyuru bandı açık',         'content',   true,  false),
  ('announcement_text',           '""'::jsonb,                                       'string',  'Duyuru metni',              'content',   true,  false),
  ('contact_address',             '"Sabırlar, 54700 Geyve / Sakarya"'::jsonb,        'string',  'İletişim adresi',           'content',   true,  false),
  ('support_hours',               '"Hafta içi 09:00 – 18:00"'::jsonb,                'string',  'Destek saatleri',           'content',   true,  false),
  ('social_instagram',            '"https://instagram.com/kabiaekolojik"'::jsonb,    'string',  'Instagram',                 'content',   true,  false),
  ('social_facebook',             '"https://facebook.com/kabiaekolojik"'::jsonb,     'string',  'Facebook',                  'content',   true,  false),
  ('social_x',                    '"https://x.com/kabiaekolojik"'::jsonb,            'string',  'X',                         'content',   true,  false),

  ('seo_default_title',           '"Kabia Ekolojik | Geyve''den Ekolojik Badem"'::jsonb, 'string', 'Varsayılan SEO başlığı', 'seo',       true,  false),
  ('seo_default_description',     '"Sakarya Geyve''de, kimyasal gübre ve ilaç kullanılmadan yetiştirilen badem. Katkısız ürünler, tek kaynaktan."'::jsonb, 'string', 'Varsayılan SEO açıklaması', 'seo', true, false),
  ('seo_social_image',            '"/images/almonds-drying.jpg"'::jsonb,             'string',  'Sosyal paylaşım görseli',   'seo',       true,  false)
on conflict (key) do nothing;

-- ---- make the shipping and store-state settings actually do something -------
-- create_order() previously hard-coded 500 / 29.90. It now reads the settings,
-- falling back to exactly those constants, and refuses to create an order while
-- checkout is switched off. Nothing else about the function changes.

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
  v_free_threshold numeric(10,2);
  v_flat_rate numeric(10,2);
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.setting_bool('checkout_enabled', true) then
    raise exception 'Şu anda sipariş alınamıyor.';
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

  v_free_threshold := public.setting_number('free_shipping_threshold', 500);
  v_flat_rate      := public.setting_number('shipping_flat_rate', 29.90);
  v_shipping := case when v_subtotal >= v_free_threshold then 0 else v_flat_rate end;
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

revoke execute on function public.create_order(jsonb, text, text, text, text, text, text, text) from public, anon;
grant  execute on function public.create_order(jsonb, text, text, text, text, text, text, text) to authenticated;
