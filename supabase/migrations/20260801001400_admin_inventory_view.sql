-- ---------------------------------------------------------------------------
-- Read model for the inventory screen.
--
-- "Critical stock" is `stock_quantity <= products.low_stock_threshold` — a
-- comparison between two columns on two tables, which PostgREST cannot express
-- as a filter. Without this view the screen would have to fetch every variant
-- and filter in the application, which is exactly the pattern the dashboard is
-- not allowed to use. The view lets the status be filtered, sorted and
-- paginated in Postgres.
--
-- security_invoker, so the RLS policies on product_variants and products
-- decide who sees what.
--
-- Rollback: drop the view.
-- ---------------------------------------------------------------------------

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
join public.products p on p.id = v.product_id;

comment on view public.admin_inventory_overview is
  'Variant-level stock with its product context and derived status. security_invoker: underlying RLS applies.';

revoke all on public.admin_inventory_overview from anon, authenticated;
grant select on public.admin_inventory_overview to authenticated;
