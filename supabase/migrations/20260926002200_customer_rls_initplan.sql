-- ============================================================================
-- Phase 2 — RLS initplan: auth.uid() -> (select auth.uid()) in customer-owned
-- tables' policies (advisor 0003_auth_rls_initplan, 32 policies).
--
-- WHAT: ALTER POLICY on the 32 *_own policies of profiles, addresses, carts,
--   cart_items, favorites, notification_preferences, payment_methods, orders,
--   order_items, order_status_history and reviews. Each USING / WITH CHECK is
--   the live expression with every auth.uid() wrapped as (select auth.uid()).
--   Policy names, commands, roles and permissiveness are untouched.
--
-- WHY: the bare call is re-evaluated per row; the scalar sub-select is
--   evaluated once per statement (initPlan). Behavior-preserving: auth.uid()
--   is stable within a statement.
--
-- IDEMPOTENT: ALTER POLICY sets the full expression; re-running is a no-op.
--
-- ROLLBACK: /Users/mustafa/kabia-maturity-pass/db-snapshots/20260926T-phase2-03-customer-rls-rollback.sql
--   (pre-change expressions: 20260926T-phase2-03-customer-rls-pre.json).
-- ============================================================================

alter policy addr_delete_own on public.addresses
  using (user_id = (select auth.uid()));
alter policy addr_insert_own on public.addresses
  with check (user_id = (select auth.uid()));
alter policy addr_select_own on public.addresses
  using (user_id = (select auth.uid()));
alter policy addr_update_own on public.addresses
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
alter policy carts_delete_own on public.carts
  using (user_id = (select auth.uid()));
alter policy carts_insert_own on public.carts
  with check (user_id = (select auth.uid()));
alter policy carts_select_own on public.carts
  using (user_id = (select auth.uid()));
alter policy carts_update_own on public.carts
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
alter policy fav_delete_own on public.favorites
  using (user_id = (select auth.uid()));
alter policy fav_insert_own on public.favorites
  with check (user_id = (select auth.uid()));
alter policy fav_select_own on public.favorites
  using (user_id = (select auth.uid()));
alter policy fav_update_own on public.favorites
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
alter policy np_delete_own on public.notification_preferences
  using (user_id = (select auth.uid()));
alter policy np_insert_own on public.notification_preferences
  with check (user_id = (select auth.uid()));
alter policy np_select_own on public.notification_preferences
  using (user_id = (select auth.uid()));
alter policy np_update_own on public.notification_preferences
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
alter policy pm_delete_own on public.payment_methods
  using (user_id = (select auth.uid()));
alter policy pm_insert_own on public.payment_methods
  with check (user_id = (select auth.uid()));
alter policy pm_select_own on public.payment_methods
  using (user_id = (select auth.uid()));
alter policy pm_update_own on public.payment_methods
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
alter policy ci_delete_own on public.cart_items
  using (cart_id IN ( SELECT carts.id
   FROM carts
  WHERE (carts.user_id = (select auth.uid()))));
alter policy ci_insert_own on public.cart_items
  with check (cart_id IN ( SELECT carts.id
   FROM carts
  WHERE (carts.user_id = (select auth.uid()))));
alter policy ci_select_own on public.cart_items
  using (cart_id IN ( SELECT carts.id
   FROM carts
  WHERE (carts.user_id = (select auth.uid()))));
alter policy ci_update_own on public.cart_items
  using (cart_id IN ( SELECT carts.id
   FROM carts
  WHERE (carts.user_id = (select auth.uid()))))
  with check (cart_id IN ( SELECT carts.id
   FROM carts
  WHERE (carts.user_id = (select auth.uid()))));
alter policy oi_select_own on public.order_items
  using (order_id IN ( SELECT orders.id
   FROM orders
  WHERE (orders.user_id = (select auth.uid()))));
alter policy osh_select_own on public.order_status_history
  using (order_id IN ( SELECT orders.id
   FROM orders
  WHERE (orders.user_id = (select auth.uid()))));
alter policy orders_select_own on public.orders
  using (user_id = (select auth.uid()));
alter policy profiles_select_own on public.profiles
  using (id = (select auth.uid()));
alter policy profiles_update_own on public.profiles
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
alter policy reviews_delete_own on public.reviews
  using (user_id = (select auth.uid()));
alter policy reviews_insert_own on public.reviews
  with check (user_id = (select auth.uid()));
alter policy reviews_update_own on public.reviews
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
