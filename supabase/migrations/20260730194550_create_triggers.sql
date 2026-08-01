-- BASELINE (reconstructed) — see 20260730194034_create_schema.sql for context.
-- Functions and triggers that existed before the admin work began.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'phone'
  )
  on conflict (id) do nothing;

  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.carts (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.set_review_verification()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  has_purchase boolean;
  v_name text;
begin
  if new.user_id is not null then
    select exists(
      select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where o.user_id = new.user_id
        and oi.product_id = new.product_id
    ) into has_purchase;
    new.is_verified_purchase := has_purchase;
    if new.reviewer_name is null then
      select p.full_name into v_name from public.profiles p where p.id = new.user_id;
      new.reviewer_name := v_name;
    end if;
  else
    new.is_verified_purchase := coalesce(new.is_verified_purchase, false);
  end if;
  return new;
end;
$$;

drop trigger if exists on_review_set_verification on public.reviews;
create trigger on_review_set_verification
before insert or update on public.reviews
for each row execute function public.set_review_verification();

create or replace function public.update_product_rating()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  pid uuid;
  v_avg numeric;
  v_cnt int;
  v_brk jsonb;
begin
  pid := coalesce(new.product_id, old.product_id);
  if pid is null then return null; end if;

  select coalesce(round(avg(rating)::numeric, 1), 0), count(*)
  into v_avg, v_cnt
  from public.reviews
  where product_id = pid;

  select jsonb_build_array(
    coalesce(round(count(*) filter (where rating = 5) * 100.0 / nullif(count(*),0))::int, 0),
    coalesce(round(count(*) filter (where rating = 4) * 100.0 / nullif(count(*),0))::int, 0),
    coalesce(round(count(*) filter (where rating = 3) * 100.0 / nullif(count(*),0))::int, 0),
    coalesce(round(count(*) filter (where rating = 2) * 100.0 / nullif(count(*),0))::int, 0),
    coalesce(round(count(*) filter (where rating = 1) * 100.0 / nullif(count(*),0))::int, 0)
  )
  into v_brk
  from public.reviews
  where product_id = pid;

  update public.products
  set rating_avg = v_avg,
      rating_count = v_cnt,
      rating_breakdown = v_brk
  where id = pid;

  return null;
end;
$$;

drop trigger if exists on_review_change_rating on public.reviews;
create trigger on_review_change_rating
after insert or delete on public.reviews
for each row execute function public.update_product_rating();

create or replace function public.touch_cart_updated_at()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  update public.carts set updated_at = now() where id = new.cart_id;
  return new;
end;
$$;

drop trigger if exists trg_touch_cart_updated on public.cart_items;
create trigger trg_touch_cart_updated
after insert or delete or update on public.cart_items
for each row execute function public.touch_cart_updated_at();
