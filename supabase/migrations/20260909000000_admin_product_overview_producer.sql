-- ---------------------------------------------------------------------------
-- KABIA Phase 3 — producer dimension in the admin product read model.
--
-- `/admin/products` reads `admin_product_overview`, whose select list predates
-- the taxonomy migration and carries neither `producer_id` nor `source`, so
-- products can be neither filtered nor grouped by producer. This adds exactly
-- three columns — `producer_id`, `producer_name`, `source` — via a producer
-- join, following the existing categories join in the same view.
--
-- NOT APPLIED YET, BY INSTRUCTION. It goes in with the final review pass.
-- Until then the product list must behave exactly as today: the list query
-- tries the enriched select and falls back to the current select when the
-- view does not expose the new columns yet, hiding the producer filter and
-- column. Nothing errors, nothing changes visibly. When this lands, the
-- dimension lights up with no code change.
--
-- Column placement is load-bearing: CREATE OR REPLACE VIEW only permits new
-- columns appended at the END (same names, same order, same types for the
-- existing ones), so producer_id / producer_name / source sit after
-- stock_status rather than beside the joins that produce them. An earlier
-- revision placed them mid-list and Postgres refused it with 42P16; the view
-- was left untouched.
--
-- Definition is otherwise identical to
-- 20260801001500_restrict_admin_views.sql: same security_invoker, same
-- has_admin_role() predicate, same grants (restated so a fresh apply is
-- explicit). `p.source` and `p.producer_id` are functionally dependent on the
-- grouped `p.id`; `pr.name` is added to GROUP BY beside `c.slug, c.name`.
--
-- No data change. No RLS change.
--
-- Rollback: recreate the view from 20260801001500 without the producer join
-- and the three columns.
-- ---------------------------------------------------------------------------

create or replace view public.admin_product_overview
with (security_invoker = true) as
select
  p.id, p.slug, p.name, p.base_price, p.original_price, p.main_image_url,
  p.is_active, p.is_featured, p.created_at, p.updated_at, p.display_order,
  p.low_stock_threshold, p.category_id,
  c.slug as category_slug,
  c.name as category_name,
  coalesce(sum(v.stock_quantity), 0)::int as total_stock,
  count(v.id)::int                        as variant_count,
  min(v.price)                            as min_price,
  max(v.price)                            as max_price,
  coalesce(string_agg(v.sku, ' ' order by v.label), '') as skus,
  case
    when coalesce(sum(v.stock_quantity), 0) = 0 then 'tukendi'
    when coalesce(sum(v.stock_quantity), 0) <= p.low_stock_threshold then 'kritik'
    else 'yeterli'
  end as stock_status,
  p.producer_id,
  pr.name as producer_name,
  p.source
from public.products p
left join public.categories c       on c.id = p.category_id
left join public.producers pr       on pr.id = p.producer_id
left join public.product_variants v on v.product_id = p.id
where public.has_admin_role()
group by p.id, c.slug, c.name, p.producer_id, pr.name, p.source;

comment on view public.admin_product_overview is
  'Product list read model with stock aggregated across variants, plus the producer dimension (producer_id, producer_name, source). security_invoker: RLS on products still applies.';

revoke all on public.admin_product_overview from anon, authenticated;
grant select on public.admin_product_overview to authenticated;
