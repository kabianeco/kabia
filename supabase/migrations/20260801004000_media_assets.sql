-- ---------------------------------------------------------------------------
-- Media library metadata.
--
-- Before this migration the media manager was Storage-listing only: /admin/media
-- enumerated storage.objects directly, which gave no alt text, no display name,
-- no dimensions, no uploader attribution, no search and no way to paginate
-- without walking every YYYY-MM/ folder. This table is the catalogue; Storage
-- stays the bytes.
--
-- What is deliberately NOT stored here:
--   * the public URL — it is derived from (bucket_id, object_path) and would
--     rot the moment the project ref or bucket name changed;
--   * a signed URL — those expire, and a stored one would break the storefront;
--   * the image itself — binaries belong in Storage, not in Postgres.
--
-- (bucket_id, object_path) is unique, which is what makes the row and the object
-- one-to-one and lets deletion reconcile the two.
--
-- Reference safety lives in the application (product_images.storage_path /
-- image_url and products.main_image_url are checked before any delete) rather
-- than in a foreign key, because product imagery predates this table: historical
-- rows point at picsum placeholders that have no media_assets row at all. A FK
-- would have required either rewriting that history or refusing those products.
--
-- Rollback: drop the policies, the trigger, then the table. Storage objects are
-- untouched by the drop.
-- ---------------------------------------------------------------------------

create table if not exists public.media_assets (
  id                uuid primary key default gen_random_uuid(),
  bucket_id         text        not null default 'product-media',
  object_path       text        not null,
  original_filename text        not null,
  display_name      text,
  mime_type         text        not null,
  file_size         bigint      not null check (file_size > 0),
  width             integer     check (width is null or width > 0),
  height            integer     check (height is null or height > 0),
  alt_text          text,
  created_by        uuid        not null references auth.users (id) on delete restrict,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- Soft delete: the row survives a Storage failure so a half-finished delete
  -- is visible and retryable rather than silently orphaning an object.
  deleted_at        timestamptz,
  constraint media_assets_object_unique unique (bucket_id, object_path),
  constraint media_assets_mime_allowed check (
    mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/avif')
  )
);

comment on table public.media_assets is
  'Catalogue of product media held in Supabase Storage. One row per Storage object; the bytes stay in the bucket.';
comment on column public.media_assets.object_path is
  'Stable path within the bucket. The canonical reference — never store a derived or signed URL.';
comment on column public.media_assets.deleted_at is
  'Soft delete. Set before the Storage object is removed so a partial failure stays visible.';

-- ---- indexes ---------------------------------------------------------------
-- The library is browsed newest-first and filtered by type; the picker searches
-- by name. Partial on deleted_at is null because every listing excludes them.

create index if not exists idx_media_assets_created_at
  on public.media_assets (created_at desc)
  where deleted_at is null;

create index if not exists idx_media_assets_mime
  on public.media_assets (mime_type, created_at desc)
  where deleted_at is null;

create index if not exists idx_media_assets_created_by
  on public.media_assets (created_by);

-- Trigram over the two searchable names, so `ilike '%term%'` in the picker does
-- not degrade into a sequential scan as the library grows.
create index if not exists idx_media_assets_search
  on public.media_assets
  using gin ((coalesce(display_name, '') || ' ' || original_filename) extensions.gin_trgm_ops);

-- ---- updated_at ------------------------------------------------------------

create or replace function public.touch_media_asset_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_media_asset_updated on public.media_assets;
create trigger trg_touch_media_asset_updated
before update on public.media_assets
for each row execute function public.touch_media_asset_updated_at();

-- ---- RLS -------------------------------------------------------------------
-- The catalogue is administrative metadata: who uploaded what, when, and under
-- which original filename. The public storefront never reads it — it renders
-- products.main_image_url and product_images.image_url, which are public bucket
-- URLs and do not consult this table. So there is no anon or customer policy
-- here at all, only administrators.

alter table public.media_assets enable row level security;

drop policy if exists media_assets_admin_select on public.media_assets;
drop policy if exists media_assets_admin_insert on public.media_assets;
drop policy if exists media_assets_admin_update on public.media_assets;
drop policy if exists media_assets_admin_delete on public.media_assets;

create policy media_assets_admin_select on public.media_assets
  for select to authenticated
  using (public.has_admin_role());

-- created_by is pinned to the caller in the policy itself, so an administrator
-- cannot attribute an upload to somebody else even by posting a crafted row.
create policy media_assets_admin_insert on public.media_assets
  for insert to authenticated
  with check (public.has_admin_role() and created_by = (select auth.uid()));

create policy media_assets_admin_update on public.media_assets
  for update to authenticated
  using (public.has_admin_role())
  with check (public.has_admin_role());

-- Hard delete of a catalogue row is super-admin only. Ordinary administrators
-- soft-delete (an UPDATE of deleted_at), which is reversible; purging the record
-- of who uploaded what is the security-sensitive operation.
create policy media_assets_admin_delete on public.media_assets
  for delete to authenticated
  using (public.is_super_admin());

revoke all on public.media_assets from anon;
grant select, insert, update on public.media_assets to authenticated;
grant delete on public.media_assets to authenticated;

-- ---- bucket limit ----------------------------------------------------------
-- Raised from 5 MB to 10 MB so a high-resolution product photograph does not
-- have to be downsampled before upload; next/image still serves optimised
-- responsive variants to the storefront. The allowed MIME list is unchanged and
-- still excludes SVG, which is not sanitised anywhere in this application.

update storage.buckets
set file_size_limit = 10485760
where id = 'product-media';
