-- ---------------------------------------------------------------------------
-- Restrict the admin read models to administrators.
--
-- Found by the authorization probe: a signed-in *customer* could select from
-- `admin_product_overview` (12 rows) and `admin_inventory_overview` (25 rows).
--
-- That was not a data leak — security_invoker was doing its job, and every row
-- returned was already readable through the public policies on `products` and
-- `product_variants`, which the storefront relies on. But a view named `admin_*`
-- answering a customer's query is a confusing security posture, and it hands
-- out a pre-joined, pre-aggregated shape (per-product stock totals, low-stock
-- thresholds) that the storefront has no reason to expose in that form.
--
-- Adding the role predicate to the view body makes the intent explicit and
-- keeps the guarantee even if a future migration widens a grant.
-- `admin_customer_overview` already scoped correctly via RLS on `profiles`
-- (a customer saw exactly their own row) but gets the same treatment for
-- consistency.
--
-- Rollback: recreate the views from 20260801001300 / 20260801001400 without the
-- trailing `where public.has_admin_role()`.
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
  end as stock_status
from public.products p
left join public.categories c       on c.id = p.category_id
left join public.product_variants v on v.product_id = p.id
where public.has_admin_role()
group by p.id, c.slug, c.name;

create or replace view public.admin_inventory_overview
with (security_invoker = true) as
select
  v.id             as variant_id,
  v.label          as variant_label,
  v.sku,
  v.price,
  v.stock_quantity,
  p.id             as product_id,
  p.name           as product_name,
  p.slug           as product_slug,
  p.main_image_url,
  p.is_active,
  p.low_stock_threshold,
  case
    when v.stock_quantity = 0                      then 'tukendi'
    when v.stock_quantity <= p.low_stock_threshold then 'kritik'
    else 'yeterli'
  end as stock_status,
  (
    select max(ia.created_at)
    from public.inventory_adjustments ia
    where ia.variant_id = v.id
  ) as last_adjusted_at
from public.product_variants v
join public.products p on p.id = v.product_id
where public.has_admin_role();

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
where public.has_admin_role()
group by pr.id;

revoke all on public.admin_product_overview   from anon, authenticated;
revoke all on public.admin_inventory_overview from anon, authenticated;
revoke all on public.admin_customer_overview  from anon, authenticated;
grant select on public.admin_product_overview   to authenticated;
grant select on public.admin_inventory_overview to authenticated;
grant select on public.admin_customer_overview  to authenticated;
