-- ---------------------------------------------------------------------------
-- Administrative RLS policies.
--
-- Every policy below is PERMISSIVE and additive. Permissive policies OR
-- together, so none of the pre-existing public-read or owner-scoped policies
-- changes meaning, and no customer gains a single row of access. Each policy is
-- scoped `TO authenticated` and gated on a database role lookup — never on
-- `TO authenticated` alone, which would be authentication without
-- authorization.
--
-- Deliberate omissions:
--   * orders   — no admin INSERT or DELETE. Orders originate at checkout, and
--                historical order data is never destroyed.
--   * order_items — read only. Line items are immutable snapshots.
--   * profiles / addresses — read only. Administrators do not edit customer
--                records; there is no business operation that requires it.
--   * categories — untouched. Public read already covers the product editor,
--                and category management is not part of this dashboard.
--
-- Rollback: drop each policy by name. No pre-existing object is altered.
-- ---------------------------------------------------------------------------

-- ---- catalogue: full management -------------------------------------------

drop policy if exists products_admin_select on public.products;
drop policy if exists products_admin_insert on public.products;
drop policy if exists products_admin_update on public.products;
drop policy if exists products_admin_delete on public.products;

-- Admins see inactive (archived) products too; the public policy is limited to
-- is_active = true and stays that way.
create policy products_admin_select on public.products
  for select to authenticated using (public.has_admin_role());
create policy products_admin_insert on public.products
  for insert to authenticated with check (public.has_admin_role());
create policy products_admin_update on public.products
  for update to authenticated using (public.has_admin_role()) with check (public.has_admin_role());
create policy products_admin_delete on public.products
  for delete to authenticated using (public.has_admin_role());

drop policy if exists variants_admin_select on public.product_variants;
drop policy if exists variants_admin_insert on public.product_variants;
drop policy if exists variants_admin_update on public.product_variants;
drop policy if exists variants_admin_delete on public.product_variants;

create policy variants_admin_select on public.product_variants
  for select to authenticated using (public.has_admin_role());
create policy variants_admin_insert on public.product_variants
  for insert to authenticated with check (public.has_admin_role());
create policy variants_admin_update on public.product_variants
  for update to authenticated using (public.has_admin_role()) with check (public.has_admin_role());
create policy variants_admin_delete on public.product_variants
  for delete to authenticated using (public.has_admin_role());

drop policy if exists images_admin_select on public.product_images;
drop policy if exists images_admin_insert on public.product_images;
drop policy if exists images_admin_update on public.product_images;
drop policy if exists images_admin_delete on public.product_images;

create policy images_admin_select on public.product_images
  for select to authenticated using (public.has_admin_role());
create policy images_admin_insert on public.product_images
  for insert to authenticated with check (public.has_admin_role());
create policy images_admin_update on public.product_images
  for update to authenticated using (public.has_admin_role()) with check (public.has_admin_role());
create policy images_admin_delete on public.product_images
  for delete to authenticated using (public.has_admin_role());

drop policy if exists nutrition_admin_select on public.nutrition_facts;
drop policy if exists nutrition_admin_insert on public.nutrition_facts;
drop policy if exists nutrition_admin_update on public.nutrition_facts;
drop policy if exists nutrition_admin_delete on public.nutrition_facts;

create policy nutrition_admin_select on public.nutrition_facts
  for select to authenticated using (public.has_admin_role());
create policy nutrition_admin_insert on public.nutrition_facts
  for insert to authenticated with check (public.has_admin_role());
create policy nutrition_admin_update on public.nutrition_facts
  for update to authenticated using (public.has_admin_role()) with check (public.has_admin_role());
create policy nutrition_admin_delete on public.nutrition_facts
  for delete to authenticated using (public.has_admin_role());

-- ---- orders: read everything, change status only ---------------------------

drop policy if exists orders_admin_select on public.orders;
drop policy if exists orders_admin_update on public.orders;

create policy orders_admin_select on public.orders
  for select to authenticated using (public.has_admin_role());
create policy orders_admin_update on public.orders
  for update to authenticated using (public.has_admin_role()) with check (public.has_admin_role());

drop policy if exists oi_admin_select on public.order_items;
create policy oi_admin_select on public.order_items
  for select to authenticated using (public.has_admin_role());

drop policy if exists osh_admin_select on public.order_status_history;
drop policy if exists osh_admin_insert on public.order_status_history;

create policy osh_admin_select on public.order_status_history
  for select to authenticated using (public.has_admin_role());
create policy osh_admin_insert on public.order_status_history
  for insert to authenticated with check (public.has_admin_role());

-- ---- customers: read only --------------------------------------------------

drop policy if exists profiles_admin_select  on public.profiles;
drop policy if exists addresses_admin_select on public.addresses;

create policy profiles_admin_select on public.profiles
  for select to authenticated using (public.has_admin_role());
create policy addresses_admin_select on public.addresses
  for select to authenticated using (public.has_admin_role());

-- Supporting indexes for the predicates the admin screens filter and sort on.
create index if not exists idx_orders_created_at on public.orders (created_at desc);
create index if not exists idx_orders_status     on public.orders (status);
create index if not exists idx_profiles_created  on public.profiles (created_at desc);
create index if not exists idx_variants_stock    on public.product_variants (stock_quantity);
