-- ---------------------------------------------------------------------------
-- Product media bucket.
--
-- The project had zero Storage buckets; product imagery pointed at picsum
-- placeholders. One bucket is created — not several — and it is the only one
-- the media manager writes to.
--
-- Product photographs are public by nature (they are rendered on the public
-- storefront by an anonymous visitor), so read is public. Every mutating
-- operation is gated on public.has_admin_role(), which means a signed-in
-- customer cannot upload, replace or delete product media.
--
-- Upsert in Supabase Storage needs INSERT + SELECT + UPDATE together; all three
-- are present below, so replacing an image works rather than silently failing.
--
-- Rollback: drop the four policies, then delete the bucket (which requires it
-- to be empty).
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-media',
  'product-media',
  true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
set public             = excluded.public,
    file_size_limit    = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists product_media_public_read  on storage.objects;
drop policy if exists product_media_admin_insert on storage.objects;
drop policy if exists product_media_admin_update on storage.objects;
drop policy if exists product_media_admin_delete on storage.objects;

create policy product_media_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'product-media');

create policy product_media_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-media' and public.has_admin_role());

create policy product_media_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'product-media' and public.has_admin_role())
  with check (bucket_id = 'product-media' and public.has_admin_role());

create policy product_media_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-media' and public.has_admin_role());
