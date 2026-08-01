-- BASELINE (reconstructed) — see 20260730194034_create_schema.sql for context.
-- The pre-existing public-read and owner-scoped policies. The admin work adds
-- policies alongside these; it never modifies or drops any of them.

alter table public.categories               enable row level security;
alter table public.products                 enable row level security;
alter table public.product_variants         enable row level security;
alter table public.product_images           enable row level security;
alter table public.nutrition_facts          enable row level security;
alter table public.reviews                  enable row level security;
alter table public.profiles                 enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.addresses                enable row level security;
alter table public.payment_methods          enable row level security;
alter table public.favorites                enable row level security;
alter table public.carts                    enable row level security;
alter table public.cart_items               enable row level security;
alter table public.orders                   enable row level security;
alter table public.order_items              enable row level security;
alter table public.order_status_history     enable row level security;

-- ---- public catalogue reads ------------------------------------------------

create policy categories_public_read on public.categories       for select using (true);
create policy variants_public_read   on public.product_variants  for select using (true);
create policy images_public_read     on public.product_images    for select using (true);
create policy nutrition_public_read  on public.nutrition_facts   for select using (true);
create policy reviews_public_read    on public.reviews           for select using (true);
create policy products_public_read   on public.products          for select using (is_active = true);

-- ---- owner-scoped ----------------------------------------------------------

create policy profiles_select_own on public.profiles for select using (id = auth.uid());
create policy profiles_update_own on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy reviews_insert_own on public.reviews for insert with check (user_id = auth.uid());
create policy reviews_update_own on public.reviews for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy reviews_delete_own on public.reviews for delete using (user_id = auth.uid());

create policy np_select_own on public.notification_preferences for select using (user_id = auth.uid());
create policy np_insert_own on public.notification_preferences for insert with check (user_id = auth.uid());
create policy np_update_own on public.notification_preferences for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy np_delete_own on public.notification_preferences for delete using (user_id = auth.uid());

create policy addr_select_own on public.addresses for select using (user_id = auth.uid());
create policy addr_insert_own on public.addresses for insert with check (user_id = auth.uid());
create policy addr_update_own on public.addresses for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy addr_delete_own on public.addresses for delete using (user_id = auth.uid());

create policy pm_select_own on public.payment_methods for select using (user_id = auth.uid());
create policy pm_insert_own on public.payment_methods for insert with check (user_id = auth.uid());
create policy pm_update_own on public.payment_methods for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy pm_delete_own on public.payment_methods for delete using (user_id = auth.uid());

create policy fav_select_own on public.favorites for select using (user_id = auth.uid());
create policy fav_insert_own on public.favorites for insert with check (user_id = auth.uid());
create policy fav_update_own on public.favorites for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy fav_delete_own on public.favorites for delete using (user_id = auth.uid());

create policy carts_select_own on public.carts for select using (user_id = auth.uid());
create policy carts_insert_own on public.carts for insert with check (user_id = auth.uid());
create policy carts_update_own on public.carts for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy carts_delete_own on public.carts for delete using (user_id = auth.uid());

create policy ci_select_own on public.cart_items for select
  using (cart_id in (select carts.id from public.carts where carts.user_id = auth.uid()));
create policy ci_insert_own on public.cart_items for insert
  with check (cart_id in (select carts.id from public.carts where carts.user_id = auth.uid()));
create policy ci_update_own on public.cart_items for update
  using (cart_id in (select carts.id from public.carts where carts.user_id = auth.uid()))
  with check (cart_id in (select carts.id from public.carts where carts.user_id = auth.uid()));
create policy ci_delete_own on public.cart_items for delete
  using (cart_id in (select carts.id from public.carts where carts.user_id = auth.uid()));

-- Orders are readable by their owner and, before the admin work, writable by
-- nobody through PostgREST — only by the SECURITY DEFINER create_order() RPC.
create policy orders_select_own on public.orders for select using (user_id = auth.uid());
create policy oi_select_own on public.order_items for select
  using (order_id in (select orders.id from public.orders where orders.user_id = auth.uid()));
create policy osh_select_own on public.order_status_history for select
  using (order_id in (select orders.id from public.orders where orders.user_id = auth.uid()));
