-- ============================================================================
-- S16 (anonymous hidden-catalogue leak): scope public child reads to active
-- parents.
--
-- WHAT: replace using(true) with an active-parent EXISTS check on
-- variants_public_read, images_public_read and nutrition_public_read.
-- products_public_read already filters is_active; categories stay open by
-- design; reviews are handled separately (S17 public_reviews view).
--
-- ROLLBACK: re-create the three policies with using (true).
--
-- BACKWARD COMPATIBILITY: behaviour-preserving for every current storefront
-- read — verified in lib/catalog.ts that children are only ever reached
-- through a parent query already filtered .eq("is_active", true), and no
-- storefront query addresses children of an inactive product directly.
-- Admin paths use their own has_admin_role() policies, untouched. Inactive /
-- draft products' prices, stock and SKUs disappear from anonymous reads,
-- which is the fix.
-- ============================================================================

drop policy if exists variants_public_read on public.product_variants;
create policy variants_public_read on public.product_variants
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_variants.product_id and p.is_active
    )
  );

drop policy if exists images_public_read on public.product_images;
create policy images_public_read on public.product_images
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id and p.is_active
    )
  );

drop policy if exists nutrition_public_read on public.nutrition_facts;
create policy nutrition_public_read on public.nutrition_facts
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = nutrition_facts.product_id and p.is_active
    )
  );
