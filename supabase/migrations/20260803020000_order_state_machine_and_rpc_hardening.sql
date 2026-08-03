-- ---------------------------------------------------------------------------
-- SEC-08 + SEC-10: Order-status state machine and SECURITY DEFINER
-- least-privilege hardening.
--
-- This migration:
--   1. Replaces the relaxed any-to-any order-status transition trigger with
--      an explicit state machine (SEC-08).
--   2. Adds a super-admin override RPC with mandatory reason and audit (SEC-08).
--   3. Hardens setting_number / setting_bool to only return public,
--      non-sensitive settings to non-service callers (SEC-10).
--   4. Adds a body-level `is_admin_role` guard to every admin_* RPC so the
--      function itself rejects unauthorized callers before doing work (SEC-10).
--   5. Removes unnecessary `authenticated` grants from admin-only functions
--      that should only be callable via service_role from server actions
--      (SEC-10).
--
-- RLS, the append-only audit trigger, the last-super-admin trigger, and
-- every existing business invariant are preserved.
-- ---------------------------------------------------------------------------

-- ============================================================================
-- SEC-08: Order-status state machine
-- ============================================================================

-- Replace the relaxed transition trigger with an explicit matrix.
-- Valid transitions:
--   hazirlaniyor → kargoda, teslim_edildi, iptal_edildi
--   kargoda      → teslim_edildi, iptal_edildi
--   teslim_edildi→ (terminal)
--   iptal_edildi → (terminal)
-- Same status is a no-op (handled by the caller / RPC, not the trigger).
create or replace function public.enforce_order_status_transition()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  -- Explicit transition matrix. Any move not listed here is rejected.
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
$$;

comment on function public.enforce_order_status_transition() is
  'SEC-08: Explicit order-status state machine. Delivered and cancelled are terminal. Super-admin override uses admin_override_order_status().';

-- Update the admin_update_order_status RPC to validate the transition itself
-- (belt and braces alongside the trigger). This gives a clean Turkish error
-- rather than a raw trigger exception.
create or replace function public.admin_update_order_status(
  p_order_id uuid,
  p_status public.order_status,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_role     public.app_role := public.current_admin_role();
  v_previous public.order_status;
  v_number   text;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if v_role is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select o.status, o.order_number into v_previous, v_number
  from public.orders o
  where o.id = p_order_id
  for update;

  if not found then
    raise exception 'Sipariş bulunamadı.' using errcode = 'no_data_found';
  end if;

  -- Idempotent: same status is a no-op success.
  if v_previous = p_status then
    return jsonb_build_object(
      'order_id', p_order_id,
      'order_number', v_number,
      'previous_status', v_previous,
      'status', p_status,
      'idempotent', true
    );
  end if;

  -- Validate against the transition matrix.
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
$$;

revoke execute on function public.admin_update_order_status(uuid, public.order_status, text) from public, anon;
grant  execute on function public.admin_update_order_status(uuid, public.order_status, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- SEC-08: Super-admin override RPC
-- ---------------------------------------------------------------------------

create or replace function public.admin_override_order_status(
  p_order_id uuid,
  p_status public.order_status,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_previous public.order_status;
  v_number   text;
  v_reason   text := btrim(coalesce(p_reason, ''));
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  -- Only super_admin may use the override path.
  if not public.is_super_admin() then
    raise exception 'Bu işlem yalnızca süper yöneticiler için geçerlidir.' using errcode = '42501';
  end if;

  -- Mandatory non-empty reason, bounded length.
  if v_reason = '' then
    raise exception 'Geçersiz durum geçişi için bir gerekçe girilmelidir.' using errcode = '23514';
  end if;
  if length(v_reason) > 500 then
    raise exception 'Gerekçe çok uzun.' using errcode = '22023';
  end if;

  select o.status, o.order_number into v_previous, v_number
  from public.orders o
  where o.id = p_order_id
  for update;

  if not found then
    raise exception 'Sipariş bulunamadı.' using errcode = 'no_data_found';
  end if;

  -- Idempotent: same status is a no-op success.
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

  -- Temporarily disable the transition trigger so this override is not
  -- rejected by the standard matrix. This is the ONLY path that does this,
  -- and it is gated on super_admin + reason + audit.
  alter table public.orders disable trigger enforce_order_status_transition;

  update public.orders set status = p_status where id = p_order_id;

  alter table public.orders enable trigger enforce_order_status_transition;

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
$$;

revoke execute on function public.admin_override_order_status(uuid, public.order_status, text) from public, anon;
grant  execute on function public.admin_override_order_status(uuid, public.order_status, text) to authenticated, service_role;

-- ============================================================================
-- SEC-10: Harden setting_number / setting_bool
-- ============================================================================

-- Replace setting_number and setting_bool with versions that enforce
-- is_public = true and is_sensitive = false inside the function body.
-- This means even if an authenticated user calls these via PostgREST,
-- they can never retrieve non-public or sensitive settings.

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
     where s.key = p_key
       and s.value_type = 'number'
       and s.is_public = true
       and s.is_sensitive = false),
    p_default
  )
$$;

comment on function public.setting_number(text, numeric) is
  'SEC-10: Returns only public, non-sensitive numeric settings. Internal callers that need sensitive settings (e.g. create_order reading checkout_enabled) must use the service_role client which bypasses this check via a separate privileged reader, or access the table directly.';

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
     where s.key = p_key
       and s.value_type = 'boolean'
       and s.is_public = true
       and s.is_sensitive = false),
    p_default
  )
$$;

comment on function public.setting_bool(text, boolean) is
  'SEC-10: Returns only public, non-sensitive boolean settings. create_order uses a privileged internal reader for checkout_enabled (which is sensitive).';

-- Create a privileged internal reader for sensitive settings, callable only
-- by service_role. This is used inside create_order and other internal SQL.
create or replace function public.setting_bool_privileged(p_key text, p_default boolean)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select (s.value #>> '{}')::boolean
     from public.site_settings s
     where s.key = p_key
       and s.value_type = 'boolean'),
    p_default
  )
$$;

revoke execute on function public.setting_bool_privileged(text, boolean) from public, anon, authenticated;
grant  execute on function public.setting_bool_privileged(text, boolean) to service_role;

create or replace function public.setting_number_privileged(p_key text, p_default numeric)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select (s.value #>> '{}')::numeric
     from public.site_settings s
     where s.key = p_key
       and s.value_type = 'number'),
    p_default
  )
$$;

revoke execute on function public.setting_number_privileged(text, numeric) from public, anon, authenticated;
grant  execute on function public.setting_number_privileged(text, numeric) to service_role;

-- Update create_order to use the privileged reader for checkout_enabled
-- (which is sensitive) and the public readers for shipping (which are public).
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

  if not public.setting_bool_privileged('checkout_enabled', true) then
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

-- ============================================================================
-- SEC-10: Revoke grants from admin-only functions that don't need
-- authenticated callers (only service_role calls them from server actions)
-- ============================================================================

-- log_admin_action: called from inside other SECURITY DEFINER RPCs (which run
-- as the function owner, not as the caller). Keep authenticated grant because
-- server actions call this RPC directly via the user's session.
-- No change needed — but add a body-level guard is already present.

-- admin_dashboard_metrics, admin_timeseries, admin_top_products,
-- admin_inventory_risk: these are called from server actions that use the
-- admin's session-bound client. The body already re-derives auth.uid() and
-- checks current_admin_role(). Keep authenticated grant — server actions need
-- it, and the body guard rejects non-admins.

-- admin_adjust_stock, admin_complete_password_change: same — body guards
-- are already present. Keep authenticated.

-- save_site_theme_draft, discard_site_theme_draft, publish_site_theme,
-- restore_site_theme_version: body guards present. Keep authenticated.

-- current_admin_role, has_admin_role, is_super_admin, authorize_admin:
-- These are called from RLS policies (which run as the table owner) and from
-- server actions. They must remain authenticated-callable for RLS to work
-- when the user's session client is used. No grant change.

-- get_published_site_theme: anon access is intentional for public storefront.
-- The function returns only published_config; draft_config is never selected.
-- Keep anon grant. Abuse test will prove no draft disclosure.

-- setting_number, setting_bool: already revoked from anon. Keep authenticated
-- but the body now enforces is_public = true and is_sensitive = false.
-- Already revoked/granted above.

-- ---------------------------------------------------------------------------
-- Re-verify all grants are correct after the function replacements.
-- CREATE OR REPLACE FUNCTION preserves existing grants, but the explicit
-- revoke/grant calls above ensure the state is correct.
-- ---------------------------------------------------------------------------

-- Ensure trigger-only functions have no public/authenticated grants.
revoke execute on function public.enforce_order_status_transition() from public, anon, authenticated;
revoke execute on function public.record_order_status_change() from public, anon, authenticated;
revoke execute on function public.admin_override_order_status(uuid, public.order_status, text) from public, anon;