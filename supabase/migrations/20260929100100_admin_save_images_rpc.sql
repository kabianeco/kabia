-- ---------------------------------------------------------------------------
-- Atomic image save for products and journal entries.
--
-- WHAT
--   public.admin_save_product_images(product_id, main_image_url, images jsonb)
--   public.admin_save_journal_images(entry_id, cover_image_url, images jsonb)
--
--   Each writes the cover/main image AND the whole ordered gallery in one call.
--   A PL/pgSQL function body is a single statement to the caller, so it is one
--   transaction: any error rolls back the gallery and the cover together. The
--   previous editor issued a products UPDATE and then one statement per image
--   through PostgREST, so a failure part-way left a product whose main image
--   and gallery disagreed.
--
-- HOW
--   images is a JSON array in display order. Array position becomes
--   sort_order. An element with an "id" updates that row (which must belong to
--   this product/entry); an element without one inserts a row; rows not
--   mentioned are deleted. The cover/main image must be one of the gallery
--   images (a product must always have one: products.main_image_url is NOT
--   NULL). A journal entry may have an empty gallery, and then its cover is
--   NULL.
--
-- SECURITY
--   SECURITY INVOKER: every statement runs as the caller, so the existing
--   admin-only RLS on products / product_images / journal_* still decides what
--   is writable. has_admin_role() is also checked explicitly, so the function
--   fails closed even if a policy is ever loosened. EXECUTE is revoked from
--   PUBLIC and anon.
--
-- ERRORS
--   Messages are Turkish, operator-facing and colon-free on purpose: the admin
--   error mapper (lib/admin/errors.ts) shows database messages that contain a
--   Turkish letter and strips everything before the first colon.
--
-- ROLLBACK
--   drop function public.admin_save_product_images(uuid, text, jsonb);
--   drop function public.admin_save_journal_images(uuid, text, jsonb);
-- ---------------------------------------------------------------------------

create or replace function public.admin_save_product_images(
  p_product_id     uuid,
  p_main_image_url text,
  p_images         jsonb
)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if not public.has_admin_role() then
    raise exception 'Bu işlem için yetkiniz yok.' using errcode = '42501';
  end if;
  if p_product_id is null then
    raise exception 'Ürün bulunamadı.' using errcode = 'P0002';
  end if;
  if p_images is null or jsonb_typeof(p_images) <> 'array' then
    raise exception 'Görsel listesi geçersiz.' using errcode = '22023';
  end if;

  v_count := jsonb_array_length(p_images);
  if v_count < 1 or v_count > 30 then
    raise exception 'Görsel sayısı 1 ile 30 arasında olmalı.' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_images) as t(item)
    where jsonb_typeof(t.item) <> 'object'
       or jsonb_typeof(t.item -> 'image_url') is distinct from 'string'
       or char_length(btrim(t.item ->> 'image_url')) not between 1 and 1000
       or char_length(coalesce(t.item ->> 'alt_text', '')) > 200
       or char_length(coalesce(t.item ->> 'storage_path', '')) > 500
  ) then
    raise exception 'Görsel bilgisi geçersiz.' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_images) as t(item)
    where nullif(t.item ->> 'id', '') is not null
      and t.item ->> 'id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) then
    raise exception 'Görsel kimliği geçersiz.' using errcode = '22023';
  end if;

  if (select count(distinct t.item ->> 'image_url') from jsonb_array_elements(p_images) as t(item)) <> v_count then
    raise exception 'Aynı görsel galeride birden fazla kez yer alamaz.' using errcode = '22023';
  end if;

  if p_main_image_url is null or not exists (
    select 1 from jsonb_array_elements(p_images) as t(item)
    where t.item ->> 'image_url' = p_main_image_url
  ) then
    raise exception 'Ana görsel galerideki görsellerden biri olmalı.' using errcode = '22023';
  end if;

  -- Serialise concurrent saves of the same product and prove it exists.
  perform 1 from public.products where id = p_product_id for update;
  if not found then
    raise exception 'Ürün bulunamadı.' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_images) as t(item)
    where nullif(t.item ->> 'id', '') is not null
      and not exists (
        select 1 from public.product_images pi
        where pi.id = (t.item ->> 'id')::uuid and pi.product_id = p_product_id
      )
  ) then
    raise exception 'Görsel kaydı bu ürüne ait değil.' using errcode = '22023';
  end if;

  delete from public.product_images pi
  where pi.product_id = p_product_id
    and not exists (
      select 1 from jsonb_array_elements(p_images) as t(item)
      where nullif(t.item ->> 'id', '') is not null and (t.item ->> 'id')::uuid = pi.id
    );

  update public.product_images pi
  set image_url    = btrim(t.item ->> 'image_url'),
      alt_text     = nullif(btrim(t.item ->> 'alt_text'), ''),
      storage_path = nullif(btrim(t.item ->> 'storage_path'), ''),
      sort_order   = (t.ord - 1)::integer
  from jsonb_array_elements(p_images) with ordinality as t(item, ord)
  where nullif(t.item ->> 'id', '') is not null
    and pi.id = (t.item ->> 'id')::uuid
    and pi.product_id = p_product_id;

  insert into public.product_images (product_id, image_url, alt_text, storage_path, sort_order)
  select p_product_id,
         btrim(t.item ->> 'image_url'),
         nullif(btrim(t.item ->> 'alt_text'), ''),
         nullif(btrim(t.item ->> 'storage_path'), ''),
         (t.ord - 1)::integer
  from jsonb_array_elements(p_images) with ordinality as t(item, ord)
  where nullif(t.item ->> 'id', '') is null;

  update public.products set main_image_url = p_main_image_url where id = p_product_id;

  return v_count;
end;
$$;

comment on function public.admin_save_product_images(uuid, text, jsonb) is
  'Writes a product''s main image and ordered gallery in one transaction. SECURITY INVOKER; RLS and has_admin_role() both apply.';

revoke execute on function public.admin_save_product_images(uuid, text, jsonb) from public, anon;
grant  execute on function public.admin_save_product_images(uuid, text, jsonb) to authenticated;

create or replace function public.admin_save_journal_images(
  p_entry_id        uuid,
  p_cover_image_url text,
  p_images          jsonb
)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if not public.has_admin_role() then
    raise exception 'Bu işlem için yetkiniz yok.' using errcode = '42501';
  end if;
  if p_entry_id is null then
    raise exception 'Günlük notu bulunamadı.' using errcode = 'P0002';
  end if;
  if p_images is null or jsonb_typeof(p_images) <> 'array' then
    raise exception 'Görsel listesi geçersiz.' using errcode = '22023';
  end if;

  v_count := jsonb_array_length(p_images);
  if v_count > 30 then
    raise exception 'Görsel sayısı en fazla 30 olabilir.' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_images) as t(item)
    where jsonb_typeof(t.item) <> 'object'
       or jsonb_typeof(t.item -> 'image_url') is distinct from 'string'
       or char_length(btrim(t.item ->> 'image_url')) not between 1 and 1000
       or char_length(coalesce(t.item ->> 'alt_text', '')) > 200
       or char_length(coalesce(t.item ->> 'storage_path', '')) > 500
  ) then
    raise exception 'Görsel bilgisi geçersiz.' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_images) as t(item)
    where nullif(t.item ->> 'id', '') is not null
      and t.item ->> 'id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) then
    raise exception 'Görsel kimliği geçersiz.' using errcode = '22023';
  end if;

  if (select count(distinct t.item ->> 'image_url') from jsonb_array_elements(p_images) as t(item)) <> v_count then
    raise exception 'Aynı görsel galeride birden fazla kez yer alamaz.' using errcode = '22023';
  end if;

  if v_count = 0 then
    if p_cover_image_url is not null then
      raise exception 'Galeride görsel yokken kapak görseli seçilemez.' using errcode = '22023';
    end if;
  elsif p_cover_image_url is null or not exists (
    select 1 from jsonb_array_elements(p_images) as t(item)
    where t.item ->> 'image_url' = p_cover_image_url
  ) then
    raise exception 'Kapak görseli galerideki görsellerden biri olmalı.' using errcode = '22023';
  end if;

  perform 1 from public.journal_entries where id = p_entry_id for update;
  if not found then
    raise exception 'Günlük notu bulunamadı.' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_images) as t(item)
    where nullif(t.item ->> 'id', '') is not null
      and not exists (
        select 1 from public.journal_entry_images ji
        where ji.id = (t.item ->> 'id')::uuid and ji.entry_id = p_entry_id
      )
  ) then
    raise exception 'Görsel kaydı bu nota ait değil.' using errcode = '22023';
  end if;

  delete from public.journal_entry_images ji
  where ji.entry_id = p_entry_id
    and not exists (
      select 1 from jsonb_array_elements(p_images) as t(item)
      where nullif(t.item ->> 'id', '') is not null and (t.item ->> 'id')::uuid = ji.id
    );

  update public.journal_entry_images ji
  set image_url    = btrim(t.item ->> 'image_url'),
      alt_text     = nullif(btrim(t.item ->> 'alt_text'), ''),
      storage_path = nullif(btrim(t.item ->> 'storage_path'), ''),
      sort_order   = (t.ord - 1)::integer
  from jsonb_array_elements(p_images) with ordinality as t(item, ord)
  where nullif(t.item ->> 'id', '') is not null
    and ji.id = (t.item ->> 'id')::uuid
    and ji.entry_id = p_entry_id;

  insert into public.journal_entry_images (entry_id, image_url, alt_text, storage_path, sort_order)
  select p_entry_id,
         btrim(t.item ->> 'image_url'),
         nullif(btrim(t.item ->> 'alt_text'), ''),
         nullif(btrim(t.item ->> 'storage_path'), ''),
         (t.ord - 1)::integer
  from jsonb_array_elements(p_images) with ordinality as t(item, ord)
  where nullif(t.item ->> 'id', '') is null;

  update public.journal_entries set cover_image_url = p_cover_image_url where id = p_entry_id;

  return v_count;
end;
$$;

comment on function public.admin_save_journal_images(uuid, text, jsonb) is
  'Writes a journal entry''s cover image and ordered gallery in one transaction. SECURITY INVOKER; RLS and has_admin_role() both apply.';

revoke execute on function public.admin_save_journal_images(uuid, text, jsonb) from public, anon;
grant  execute on function public.admin_save_journal_images(uuid, text, jsonb) to authenticated;
