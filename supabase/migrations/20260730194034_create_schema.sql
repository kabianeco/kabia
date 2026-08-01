-- ---------------------------------------------------------------------------
-- BASELINE (reconstructed)
--
-- This project's first seven migrations were applied to Supabase before the
-- repository tracked a `supabase/` directory, so the remote was ahead of the
-- repo. These baseline files reconstruct that starting state from a live read
-- of project `xlubpolwuseafpcienql`, using the names already recorded in
-- `supabase_migrations.schema_migrations` so they are recognised as applied and
-- are never re-pushed to this project.
--
-- Everything is written idempotently: replaying it against the live database is
-- a no-op. Catalogue seed *data* is deliberately not reproduced here — see the
-- two seed baseline files.
-- ---------------------------------------------------------------------------

create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'order_status' and n.nspname = 'public') then
    create type public.order_status as enum ('hazirlaniyor', 'kargoda', 'teslim_edildi', 'iptal_edildi');
  end if;
end $$;

-- ---- catalogue -------------------------------------------------------------

create table if not exists public.categories (
  id   uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique
);

create table if not exists public.products (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,
  name               text not null,
  category_id        uuid not null references public.categories(id),
  description        text not null,
  short_description  text not null,
  base_price         numeric(10,2) not null check (base_price >= 0),
  original_price     numeric(10,2),
  main_image_url     text not null,
  origin             text,
  production_method  text,
  shelf_life         text,
  storage_conditions text,
  certifications     text,
  is_active          boolean not null default true,
  is_featured        boolean not null default false,
  rating_avg         numeric(2,1) not null default 0 check (rating_avg >= 0 and rating_avg <= 5),
  rating_count       integer not null default 0 check (rating_count >= 0),
  rating_breakdown   jsonb not null default '[0,0,0,0,0]'::jsonb,
  created_at         timestamptz not null default now()
);

create table if not exists public.product_variants (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products(id) on delete cascade,
  label          text not null,
  price          numeric(10,2) not null check (price >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  sku            text unique
);

create table if not exists public.product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url  text not null,
  sort_order integer not null default 0
);

create table if not exists public.nutrition_facts (
  product_id    uuid primary key references public.products(id) on delete cascade,
  calories      text,
  protein       text,
  carbohydrates text,
  fat           text,
  fiber         text,
  sodium        text
);

create table if not exists public.reviews (
  id                   uuid primary key default gen_random_uuid(),
  product_id           uuid not null references public.products(id) on delete cascade,
  user_id              uuid references auth.users(id) on delete set null,
  reviewer_name        text,
  rating               integer not null check (rating >= 1 and rating <= 5),
  review_text          text not null,
  is_verified_purchase boolean not null default false,
  created_at           timestamptz not null default now()
);

-- ---- customer account ------------------------------------------------------

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text not null,
  phone      text,
  birth_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_preferences (
  user_id         uuid primary key references public.profiles(id) on delete cascade,
  campaign_emails boolean not null default true,
  order_status    boolean not null default true,
  sms             boolean not null default false,
  stock_alerts    boolean not null default true
);

create table if not exists public.addresses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  label         text not null,
  full_name     text not null,
  phone         text not null,
  address_line1 text not null,
  address_line2 text,
  city          text not null,
  district      text not null,
  postal_code   text not null,
  is_default    boolean not null default false,
  created_at    timestamptz not null default now()
);

create table if not exists public.payment_methods (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  card_brand   text,
  last4        char(4),
  expiry_month integer check (expiry_month is null or (expiry_month >= 1 and expiry_month <= 12)),
  expiry_year  integer,
  card_name    text,
  is_default   boolean not null default false,
  created_at   timestamptz not null default now()
);

create table if not exists public.favorites (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---- cart ------------------------------------------------------------------

create table if not exists public.carts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cart_items (
  id         uuid primary key default gen_random_uuid(),
  cart_id    uuid not null references public.carts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  quantity   integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);

-- ---- orders ----------------------------------------------------------------

create table if not exists public.orders (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references public.profiles(id) on delete cascade,
  order_number            text not null unique,
  status                  public.order_status not null default 'hazirlaniyor',
  subtotal                numeric(10,2) not null check (subtotal >= 0),
  shipping_cost           numeric(10,2) not null check (shipping_cost >= 0),
  total                   numeric(10,2) not null check (total >= 0),
  shipping_address        jsonb not null,
  payment_method_snapshot jsonb not null,
  full_name               text not null,
  email                   text not null,
  created_at              timestamptz not null default now()
);

create table if not exists public.order_items (
  id                     uuid primary key default gen_random_uuid(),
  order_id               uuid not null references public.orders(id) on delete cascade,
  product_id             uuid references public.products(id) on delete set null,
  variant_id             uuid references public.product_variants(id) on delete set null,
  product_name_snapshot  text not null,
  variant_label_snapshot text not null,
  product_slug_snapshot  text not null,
  product_image_snapshot text not null,
  unit_price_snapshot    numeric(10,2) not null check (unit_price_snapshot >= 0),
  quantity               integer not null check (quantity > 0),
  line_total             numeric(10,2) not null check (line_total >= 0)
);

create table if not exists public.order_status_history (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders(id) on delete cascade,
  status     public.order_status not null,
  changed_at timestamptz not null default now()
);

-- ---- indexes ---------------------------------------------------------------

create index        if not exists idx_products_category_id           on public.products (category_id);
create index        if not exists idx_products_is_active             on public.products (is_active);
create index        if not exists idx_products_is_featured           on public.products (is_featured);
create index        if not exists idx_product_variants_product_id    on public.product_variants (product_id);
create unique index if not exists uq_product_variants_product_label  on public.product_variants (product_id, label);
create index        if not exists idx_product_images_product_id      on public.product_images (product_id);
create index        if not exists idx_reviews_product_id             on public.reviews (product_id);
create index        if not exists idx_reviews_user_id                on public.reviews (user_id);
create unique index if not exists uq_reviews_product_user            on public.reviews (product_id, user_id) where user_id is not null;
create index        if not exists idx_addresses_user_id              on public.addresses (user_id);
create index        if not exists idx_payment_methods_user_id        on public.payment_methods (user_id);
create index        if not exists idx_favorites_user_id              on public.favorites (user_id);
create index        if not exists idx_favorites_product_id           on public.favorites (product_id);
create unique index if not exists uq_favorites_user_product          on public.favorites (user_id, product_id);
create index        if not exists idx_carts_user_id                  on public.carts (user_id);
create index        if not exists idx_cart_items_cart_id             on public.cart_items (cart_id);
create index        if not exists idx_cart_items_variant_id          on public.cart_items (variant_id);
create unique index if not exists uq_cart_items_cart_variant         on public.cart_items (cart_id, variant_id);
create index        if not exists idx_orders_user_id                 on public.orders (user_id);
create index        if not exists idx_order_items_order_id           on public.order_items (order_id);
create index        if not exists idx_order_status_history_order_id  on public.order_status_history (order_id);
