-- ---------------------------------------------------------------------------
-- Read models for the product and customer list screens.
--
-- Both screens need per-row aggregates — a product's total stock across its
-- variants, a customer's order count and lifetime spend — that they also have
-- to sort, filter and paginate by. Doing that in the application would mean
-- fetching every row to compute a column, which is exactly what the dashboard
-- must not do. These views push it into Postgres.
--
-- `security_invoker = true` is the important part. A view without it runs as
-- its owner and silently bypasses RLS, which would have turned
-- admin_customer_overview into a public dump of every customer's spending. With
-- it, the underlying policies still decide: an administrator sees everyone, a
-- customer sees only their own row, and anonymous access is revoked outright.
--
-- Rollback: drop both views.
-- ---------------------------------------------------------------------------

create or replace view public.admin_product_overview
with (security_invoker = true) as
select
  p.id,
  p.slug,
  p.name,
  p.base_price,
  p.original_price,
  p.main_image_url,
  p.is_active,
  p.is_featured,
  p.created_at,
  p.updated_at,
  p.display_order,
  p.low_stock_threshold,
  p.category_id,
  c.slug as category_slug,
  c.name as category_name,
  coalesce(sum(v.stock_quantity), 0)::int as total_stock,
  count(v.id)::int                        as variant_count,
  min(v.price)                            as min_price,
  max(v.price)                            as max_price,
  -- Space-joined so a single ILIKE can search every SKU on the product.
  coalesce(string_agg(v.sku, ' ' order by v.label), '') as skus,
  case
    when coalesce(sum(v.stock_quantity), 0) = 0 then 'tukendi'
    when coalesce(sum(v.stock_quantity), 0) <= p.low_stock_threshold then 'kritik'
    else 'yeterli'
  end as stock_status
from public.products p
left join public.categories c       on c.id = p.category_id
left join public.product_variants v on v.product_id = p.id
group by p.id, c.slug, c.name;

comment on view public.admin_product_overview is
  'Product list read model with stock aggregated across variants. security_invoker: RLS on products still applies.';

create or replace view public.admin_customer_overview
with (security_invoker = true) as
select
  pr.id,
  pr.full_name,
  pr.phone,
  pr.created_at,
  count(o.id) filter (where o.status <> 'iptal_edildi')::int          as order_count,
  count(o.id) filter (where o.status = 'iptal_edildi')::int           as cancelled_count,
  coalesce(sum(o.total) filter (where o.status <> 'iptal_edildi'), 0) as total_spent,
  max(o.created_at)                                                   as last_order_at
from public.profiles pr
left join public.orders o on o.user_id = pr.id
group by pr.id;

comment on view public.admin_customer_overview is
  'Customer list read model with order count and lifetime spend. security_invoker: a customer sees only their own row.';

revoke all on public.admin_product_overview  from anon, authenticated;
revoke all on public.admin_customer_overview from anon, authenticated;
grant select on public.admin_product_overview  to authenticated;
grant select on public.admin_customer_overview to authenticated;
