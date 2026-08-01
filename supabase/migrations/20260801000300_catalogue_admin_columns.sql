-- ---------------------------------------------------------------------------
-- Columns the dashboard needs that the catalogue did not have. Every one is
-- additive and defaulted, so the public store's explicit column selects are
-- unaffected and no existing row changes meaning.
--
-- Rollback: drop the trigger and function, then drop the added columns.
-- ---------------------------------------------------------------------------

alter table public.products add column if not exists updated_at           timestamptz not null default now();
alter table public.products add column if not exists low_stock_threshold  integer     not null default 5;
alter table public.products add column if not exists seo_title            text;
alter table public.products add column if not exists seo_description      text;
alter table public.products add column if not exists display_order        integer     not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_low_stock_threshold_check') then
    alter table public.products
      add constraint products_low_stock_threshold_check check (low_stock_threshold >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_seo_title_len_check') then
    alter table public.products
      add constraint products_seo_title_len_check check (seo_title is null or char_length(seo_title) <= 70);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_seo_description_len_check') then
    alter table public.products
      add constraint products_seo_description_len_check check (seo_description is null or char_length(seo_description) <= 200);
  end if;
end $$;

comment on column public.products.low_stock_threshold is
  'Per-product low-stock line, compared against the sum of its variants'' stock. Falls back to the default_low_stock_threshold site setting when never changed.';
comment on column public.products.display_order is
  'Manual ordering for the storefront. Lower sorts first; ties fall back to created_at.';

-- Seed updated_at from created_at rather than leaving every product looking as
-- though it was edited the moment this migration ran.
update public.products set updated_at = created_at where updated_at > created_at;

alter table public.product_images add column if not exists alt_text     text;
alter table public.product_images add column if not exists storage_path text;

comment on column public.product_images.storage_path is
  'Object path inside the product-media Storage bucket, when the image was uploaded through the admin media manager. NULL for externally hosted images.';

-- ---- updated_at maintenance ------------------------------------------------
-- The review triggers write rating aggregates back onto products. Those are
-- derived values, not edits, so they must not move updated_at.

create or replace function public.touch_products_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if (to_jsonb(new) - 'rating_avg' - 'rating_count' - 'rating_breakdown' - 'updated_at')
     is distinct from
     (to_jsonb(old) - 'rating_avg' - 'rating_count' - 'rating_breakdown' - 'updated_at')
  then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_products_touch_updated on public.products;
create trigger trg_products_touch_updated
before update on public.products
for each row execute function public.touch_products_updated_at();

revoke execute on function public.touch_products_updated_at() from public, anon, authenticated;

create index if not exists idx_products_updated_at    on public.products (updated_at desc);
create index if not exists idx_products_display_order on public.products (display_order, created_at);
