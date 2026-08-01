-- ---------------------------------------------------------------------------
-- Category management for the admin dashboard.
--
-- The public read policy on categories already exists; this adds the full
-- administrative lifecycle so administrators can create and rename categories
-- from the dashboard. Deletion is allowed only when no product references the
-- category, enforced by the foreign key — the database raises a foreign-key
-- violation if a delete would orphan products.
-- ---------------------------------------------------------------------------

drop policy if exists categories_admin_insert on public.categories;
drop policy if exists categories_admin_update on public.categories;
drop policy if exists categories_admin_delete on public.categories;

create policy categories_admin_insert on public.categories
  for insert to authenticated with check (public.has_admin_role());
create policy categories_admin_update on public.categories
  for update to authenticated using (public.has_admin_role()) with check (public.has_admin_role());
create policy categories_admin_delete on public.categories
  for delete to authenticated using (public.has_admin_role());
