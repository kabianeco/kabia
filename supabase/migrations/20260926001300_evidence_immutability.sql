-- ============================================================================
-- S19 (admin evidence columns rewritable): immutability + server-set guards.
--
-- WHAT (one small trigger per table, guard_site_settings_update style; all
-- triggers named guard_* so they fire before the existing touch_* triggers,
-- and updated_at is excluded everywhere as trigger maintenance):
--   * contact_messages: only (status, read_at) may move via direct writes.
--   * media_assets: only (display_name, alt_text, deleted_at) may move;
--     created_by/bucket_id/object_path (+ file facts) immutable after insert.
--   * blog_posts: created_by and version reject client writes (the version
--     bump stays in touch_blog_post_updated_at); updated_by is FORCED to
--     auth.uid() server-side, ignoring the submitted value.
--   * site_settings: guard_site_settings_update() re-created with one added
--     line forcing new.updated_by := auth.uid() (column nullable — migration
--     writes with no session get null, same as an omitted value; the admin
--     action already sends the caller's id, so its value is unchanged).
--   * products: rating_avg/rating_count/rating_breakdown reject direct
--     writes unless kabia.allow_rating_write is set; update_product_rating()
--     re-created with that flag (it is the only legitimate writer).
--
-- ROLLBACK: drop the four guard triggers/functions; restore the two
-- re-created bodies from db-snapshots (guard_site_settings_update in
-- 20260925T2344 reads; update_product_rating in the §7 reads).
--
-- BACKWARD COMPATIBILITY: every admin action sends only whitelisted columns
-- today (messages {status,read_at}; media {display_name,alt_text} + soft
-- delete; blog editor pins updated_by; PRODUCT_WRITE_COLUMNS omits rating_*)
-- — verified in code. Triggers maintain updated_at/version as before. No
-- signature, grant or RLS change.
-- ============================================================================

-- ---- contact_messages: status + read_at only -------------------------------
create or replace function public.guard_contact_messages_immutable()
returns trigger language plpgsql set search_path to 'public', 'pg_temp'
as $function$
begin
  if (to_jsonb(new) - 'status' - 'read_at' - 'updated_at')
     is distinct from
     (to_jsonb(old) - 'status' - 'read_at' - 'updated_at')
  then
    raise exception 'Yalnızca durum ve okunma bilgisi güncellenebilir.'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

drop trigger if exists guard_contact_messages_immutable on public.contact_messages;
create trigger guard_contact_messages_immutable
before update on public.contact_messages
for each row execute function public.guard_contact_messages_immutable();
revoke execute on function public.guard_contact_messages_immutable()
  from public, anon, authenticated;

-- ---- media_assets: display facts + soft delete only ------------------------
create or replace function public.guard_media_assets_immutable()
returns trigger language plpgsql set search_path to 'public', 'pg_temp'
as $function$
begin
  if (to_jsonb(new) - 'display_name' - 'alt_text' - 'deleted_at' - 'updated_at')
     is distinct from
     (to_jsonb(old) - 'display_name' - 'alt_text' - 'deleted_at' - 'updated_at')
  then
    raise exception 'Ortam kaydı kimliği değiştirilemez.'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

drop trigger if exists guard_media_assets_immutable on public.media_assets;
create trigger guard_media_assets_immutable
before update on public.media_assets
for each row execute function public.guard_media_assets_immutable();
revoke execute on function public.guard_media_assets_immutable()
  from public, anon, authenticated;

-- ---- blog_posts: no client writes to created_by/version; force updated_by --
create or replace function public.guard_blog_posts_immutable()
returns trigger language plpgsql set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'Yazı sahipliği değiştirilemez.' using errcode = '42501';
  end if;
  if new.version is distinct from old.version then
    raise exception 'Sürüm yalnızca sistem tarafından artırılır.' using errcode = '42501';
  end if;
  -- Server-set identity: ignore whatever the client submitted.
  new.updated_by := auth.uid();
  return new;
end;
$function$;

drop trigger if exists guard_blog_posts_immutable on public.blog_posts;
create trigger guard_blog_posts_immutable
before update on public.blog_posts
for each row execute function public.guard_blog_posts_immutable();
revoke execute on function public.guard_blog_posts_immutable()
  from public, anon, authenticated;

-- ---- site_settings: force updated_by server-side ----------------------------
create or replace function public.guard_site_settings_update()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.key          is distinct from old.key
  or new.value_type   is distinct from old.value_type
  or new.label        is distinct from old.label
  or new.group_key    is distinct from old.group_key
  or new.is_public    is distinct from old.is_public
  or new.is_sensitive is distinct from old.is_sensitive then
    raise exception 'Yalnızca ayar değeri güncellenebilir.' using errcode = '42501';
  end if;
  -- S19: authorship is server-set, never client-supplied.
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$function$;

-- ---- products: rating_* trigger-maintained only -----------------------------
create or replace function public.guard_products_rating()
returns trigger language plpgsql set search_path to 'public', 'pg_temp'
as $function$
begin
  if current_setting('kabia.allow_rating_write', true) = 'on' then
    return new;
  end if;
  if new.rating_avg         is distinct from old.rating_avg
  or new.rating_count       is distinct from old.rating_count
  or new.rating_breakdown   is distinct from old.rating_breakdown then
    raise exception 'Puanlar yalnızca değerlendirmelerden hesaplanır.'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

drop trigger if exists guard_products_rating on public.products;
create trigger guard_products_rating
before update on public.products
for each row execute function public.guard_products_rating();
revoke execute on function public.guard_products_rating()
  from public, anon, authenticated();

create or replace function public.update_product_rating()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  pid uuid;
  v_avg numeric;
  v_cnt int;
  v_brk jsonb;
begin
  -- S19: the sole legitimate writer of products.rating_*.
  perform set_config('kabia.allow_rating_write', 'on', true);
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
$function$;
