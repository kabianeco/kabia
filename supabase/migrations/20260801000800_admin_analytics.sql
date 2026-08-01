-- ---------------------------------------------------------------------------
-- Dashboard aggregations and search support.
--
-- These exist so the dashboard never pulls whole tables into the browser to
-- count them. Each function:
--   * re-checks the caller's administrative role in its own body,
--   * pins search_path,
--   * has EXECUTE revoked from PUBLIC and anon,
--   * returns only aggregates — no customer rows, no order rows, no PII beyond
--     what the admin screens already display.
--
-- Revenue definition, applied identically everywhere: the sum of `total` over
-- orders whose status is NOT 'iptal_edildi'. This project has no payment
-- status and no payment provider (see docs/admin-architecture.md §15), so
-- "cancelled is excluded, everything else counts" is the only honest rule
-- available, and the UI states it.
--
-- Day bucketing uses the store's real timezone rather than UTC, so "today" in
-- the dashboard matches "today" in Geyve.
--
-- Rollback: drop the four functions and the trigram indexes.
-- ---------------------------------------------------------------------------

create extension if not exists pg_trgm with schema extensions;

-- Search indexes. Every admin search runs server-side against one of these.
create index if not exists idx_products_name_trgm
  on public.products using gin (name extensions.gin_trgm_ops);
create index if not exists idx_products_slug_trgm
  on public.products using gin (slug extensions.gin_trgm_ops);
create index if not exists idx_variants_sku_trgm
  on public.product_variants using gin (sku extensions.gin_trgm_ops);
create index if not exists idx_profiles_name_trgm
  on public.profiles using gin (full_name extensions.gin_trgm_ops);
create index if not exists idx_orders_number_trgm
  on public.orders using gin (order_number extensions.gin_trgm_ops);
create index if not exists idx_orders_fullname_trgm
  on public.orders using gin (full_name extensions.gin_trgm_ops);
create index if not exists idx_orders_email_trgm
  on public.orders using gin (email extensions.gin_trgm_ops);
create index if not exists idx_order_items_product
  on public.order_items (product_id);

-- ---- headline counters -----------------------------------------------------

create or replace function public.admin_dashboard_metrics(
  p_from timestamptz,
  p_to   timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not public.has_admin_role() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'revenue_total',        coalesce((select sum(o.total) from public.orders o where o.status <> 'iptal_edildi'), 0),
    'revenue_period',       coalesce((select sum(o.total) from public.orders o where o.status <> 'iptal_edildi' and o.created_at >= p_from and o.created_at < p_to), 0),
    'orders_total',         (select count(*) from public.orders),
    'orders_period',        (select count(*) from public.orders o where o.created_at >= p_from and o.created_at < p_to),
    'orders_preparing',     (select count(*) from public.orders o where o.status = 'hazirlaniyor'),
    'orders_shipped',       (select count(*) from public.orders o where o.status = 'kargoda'),
    'orders_delivered',     (select count(*) from public.orders o where o.status = 'teslim_edildi'),
    'orders_cancelled',     (select count(*) from public.orders o where o.status = 'iptal_edildi'),
    'average_order_value',  coalesce((
        select avg(o.total) from public.orders o
        where o.status <> 'iptal_edildi' and o.created_at >= p_from and o.created_at < p_to
      ), 0),
    'customers_total',      (select count(*) from public.profiles),
    'customers_period',     (select count(*) from public.profiles pr where pr.created_at >= p_from and pr.created_at < p_to),
    'products_active',      (select count(*) from public.products p where p.is_active),
    'products_archived',    (select count(*) from public.products p where not p.is_active),
    'products_out_of_stock',(select count(*) from public.products p
                             where p.is_active
                               and coalesce((select sum(v.stock_quantity) from public.product_variants v where v.product_id = p.id), 0) = 0),
    'products_low_stock',   (select count(*) from public.products p
                             where p.is_active
                               and coalesce((select sum(v.stock_quantity) from public.product_variants v where v.product_id = p.id), 0) > 0
                               and coalesce((select sum(v.stock_quantity) from public.product_variants v where v.product_id = p.id), 0) <= p.low_stock_threshold)
  )
  into v_result;

  return v_result;
end;
$$;

-- ---- revenue / orders / signups over time ----------------------------------

create or replace function public.admin_timeseries(
  p_from timestamptz,
  p_to   timestamptz,
  p_tz   text default 'Europe/Istanbul'
)
returns table (
  bucket_date   date,
  revenue       numeric,
  order_count   bigint,
  new_customers bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_admin_role() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  -- Bounded by construction: a caller cannot ask for an unbounded range.
  if p_to <= p_from or (p_to - p_from) > interval '400 days' then
    raise exception 'Geçersiz tarih aralığı.' using errcode = 'check_violation';
  end if;

  return query
  with days as (
    select generate_series(
      (p_from at time zone p_tz)::date,
      (p_to   at time zone p_tz)::date - 1,
      interval '1 day'
    )::date as d
  ),
  order_rows as (
    select (o.created_at at time zone p_tz)::date as d,
           sum(o.total) filter (where o.status <> 'iptal_edildi') as revenue,
           count(*) as cnt
    from public.orders o
    where o.created_at >= p_from and o.created_at < p_to
    group by 1
  ),
  customer_rows as (
    select (pr.created_at at time zone p_tz)::date as d, count(*) as cnt
    from public.profiles pr
    where pr.created_at >= p_from and pr.created_at < p_to
    group by 1
  )
  select days.d,
         coalesce(order_rows.revenue, 0)::numeric,
         coalesce(order_rows.cnt, 0)::bigint,
         coalesce(customer_rows.cnt, 0)::bigint
  from days
  left join order_rows    on order_rows.d = days.d
  left join customer_rows on customer_rows.d = days.d
  order by days.d;
end;
$$;

-- ---- best sellers ----------------------------------------------------------

create or replace function public.admin_top_products(
  p_from  timestamptz,
  p_to    timestamptz,
  p_limit integer default 5
)
returns table (
  product_id uuid,
  name       text,
  slug       text,
  image_url  text,
  units_sold bigint,
  revenue    numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_admin_role() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  return query
  select oi.product_id,
         max(oi.product_name_snapshot)  as name,
         max(oi.product_slug_snapshot)  as slug,
         max(oi.product_image_snapshot) as image_url,
         sum(oi.quantity)::bigint       as units_sold,
         sum(oi.line_total)::numeric    as revenue
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.status <> 'iptal_edildi'
    and o.created_at >= p_from
    and o.created_at < p_to
    and oi.product_id is not null
  group by oi.product_id
  order by units_sold desc, revenue desc
  limit greatest(1, least(coalesce(p_limit, 5), 50));
end;
$$;

-- ---- inventory risk --------------------------------------------------------

create or replace function public.admin_inventory_risk()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not public.has_admin_role() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  with stock as (
    select p.id,
           p.low_stock_threshold,
           coalesce((select sum(v.stock_quantity) from public.product_variants v where v.product_id = p.id), 0) as qty
    from public.products p
    where p.is_active
  )
  select jsonb_build_object(
    'out_of_stock', count(*) filter (where qty = 0),
    'low',          count(*) filter (where qty > 0 and qty <= low_stock_threshold),
    'healthy',      count(*) filter (where qty > low_stock_threshold)
  )
  into v_result
  from stock;

  return v_result;
end;
$$;

revoke execute on function public.admin_dashboard_metrics(timestamptz, timestamptz)      from public, anon;
revoke execute on function public.admin_timeseries(timestamptz, timestamptz, text)       from public, anon;
revoke execute on function public.admin_top_products(timestamptz, timestamptz, integer)  from public, anon;
revoke execute on function public.admin_inventory_risk()                                 from public, anon;

grant execute on function public.admin_dashboard_metrics(timestamptz, timestamptz)     to authenticated;
grant execute on function public.admin_timeseries(timestamptz, timestamptz, text)      to authenticated;
grant execute on function public.admin_top_products(timestamptz, timestamptz, integer) to authenticated;
grant execute on function public.admin_inventory_risk()                                to authenticated;
