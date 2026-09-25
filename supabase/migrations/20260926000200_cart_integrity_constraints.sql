-- ============================================================================
-- S1 (cart product/variant mismatch) + S3 (quantity DB bound): cart integrity
-- at rest.
--
-- WHAT:
--   1. Delete already-mismatched cart_items rows (carts are ephemeral;
--      pre-approved). Verified 0 rows live on 2026-09-26 — no-op, kept so a
--      replay on any database converges.
--   2. UNIQUE (id, product_id) on product_variants — redundant for uniqueness
--      (id is the PK) but required as the target of the composite FK.
--   3. Composite FK cart_items (variant_id, product_id) ->
--      product_variants (id, product_id) ON DELETE CASCADE. From here on a
--      {product_id: expensive, variant_id: cheap} row cannot be inserted, so
--      create_order can never price one product under another's name.
--   4. CHECK cart_items_quantity_range: quantity BETWEEN 1 AND 99.
--
-- WHY NOT VALID/VALIDATE: cart_items held 0 rows when verified, so a plain
-- ADD CONSTRAINT takes no rewrite lock of consequence; the DO-block guards
-- make replay safe.
--
-- ROLLBACK: alter table cart_items drop constraint fk_cart_items_variant_coherent;
-- alter table cart_items drop constraint cart_items_quantity_range;
-- alter table product_variants drop constraint uq_product_variants_id_product;
--
-- BACKWARD COMPATIBILITY (deployed production code runs against this DB):
--   * No parameter, column, or grant is removed or renamed. RLS policies
--     untouched. Deployed inserts send product_id + variant_id taken from the
--     same catalogue item, so the composite FK accepts everything the
--     deployed client legitimately sends (verified: 0 mismatched rows live,
--     and the mismatch shape was never producible by the shipped UI — only by
--     crafted console inserts).
--   * Quantity 1..99: the shipped UI clamps to 99 and deletes at <= 0; 0 rows
--     live violate the bound. A >99 cart is only reachable by console/crafted
--     writes, which this constraint is meant to stop.
-- ============================================================================

-- 1. Scoped poison cleanup (pre-approved; carts are ephemeral).
delete from public.cart_items ci
using public.product_variants pv
where pv.id = ci.variant_id
  and pv.product_id is distinct from ci.product_id;

-- 2. FK target on the variant side.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'uq_product_variants_id_product'
  ) then
    alter table public.product_variants
      add constraint uq_product_variants_id_product unique (id, product_id);
  end if;
end;
$$;

-- 3. Coherence FK on the cart side.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'fk_cart_items_variant_coherent'
  ) then
    alter table public.cart_items
      add constraint fk_cart_items_variant_coherent
      foreign key (variant_id, product_id)
      references public.product_variants (id, product_id)
      on delete cascade;
  end if;
end;
$$;

-- 4. Quantity bound at rest (client clamps in lib/cart-context.tsx; S3).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'cart_items_quantity_range'
  ) then
    alter table public.cart_items
      add constraint cart_items_quantity_range
      check (quantity >= 1 and quantity <= 99);
  end if;
end;
$$;
