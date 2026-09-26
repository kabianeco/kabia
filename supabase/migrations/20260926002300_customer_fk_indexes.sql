-- ============================================================================
-- Phase 2 — covering indexes for unindexed customer/order foreign keys, and
-- removal of the duplicate site_theme_settings unique index.
--
-- WHAT:
--   1. idx_cart_items_product_id (product_id) — covers cart_items_product_id_fkey.
--   2. idx_cart_items_variant_product (variant_id, product_id) — covers
--      fk_cart_items_variant_coherent (composite FK to product_variants).
--   3. idx_order_items_variant_id (variant_id) — covers order_items_variant_id_fkey.
--   4. drop index site_theme_settings_site_key_uniq: an exact duplicate of
--      site_theme_settings_site_key_key, which backs the UNIQUE constraint and
--      stays. Verified before: 0 dependents on the dropped index, no FK
--      references site_key.
--
-- WHY: advisor 0001 (unindexed foreign keys) for the customer/order tables;
--   deletes/updates on products and variants otherwise scan these tables.
--   Advisor "duplicate index" on site_theme_settings.
--   Not changed on purpose: unused-index findings, non-customer FKs (blog,
--   user_roles, site_theme_*).
--
-- IDEMPOTENT: if not exists / if exists. Tables are small, so plain (not
--   CONCURRENTLY) creation inside the migration transaction is fine.
--
-- ROLLBACK:
--   drop index if exists public.idx_cart_items_product_id;
--   drop index if exists public.idx_cart_items_variant_product;
--   drop index if exists public.idx_order_items_variant_id;
--   create unique index if not exists site_theme_settings_site_key_uniq on public.site_theme_settings using btree (site_key);
--   Snapshot: /Users/mustafa/kabia-maturity-pass/db-snapshots/20260926T-phase2-04-indexes-pre.json
-- ============================================================================

create index if not exists idx_cart_items_product_id on public.cart_items (product_id);
create index if not exists idx_cart_items_variant_product on public.cart_items (variant_id, product_id);
create index if not exists idx_order_items_variant_id on public.order_items (variant_id);

drop index if exists public.site_theme_settings_site_key_uniq;
