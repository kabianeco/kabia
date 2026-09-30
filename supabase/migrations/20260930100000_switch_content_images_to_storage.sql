-- ---------------------------------------------------------------------------
-- Switch content-image references from public/ paths to Supabase Storage URLs.
--
-- WHAT
--   Rewrites, from the old local path to the new public Storage URL:
--     products.main_image_url, product_images.image_url (+ storage_path),
--     producers.photo_url, journal_entries.cover_image_url,
--     journal_entry_images.image_url (+ storage_path).
--   28 files, {"products":10,"product_images":21,"producers":10,"journal_entries":6,"journal_entry_images":6} rows expected to change
--   (rows per table that currently hold a mapped local path).
--   The block is generated from the upload's mapping file
--   (/Users/mustafa/kabia-media-migration/mapping.json) by scripts/build-switch-migration.ts and is one atomic
--   statement.
--
-- WHY
--   Content images are managed from the admin media library and live in
--   Storage; public/ keeps only design images. The files are byte-identical
--   copies of what public/ serves (SHA-256 verified after upload), so nothing
--   changes on the storefront except where the bytes come from. The deployed
--   code already accepts the Storage host (next/image remotePatterns,
--   isAllowedImageUrl, CSP img-src), so this can be applied before a deploy.
--
-- SAFETY
--   * Before writing it checks that every target is a live row in media_assets.
--   * After writing it checks that no old path survives in any of the tables;
--     either check failing raises and rolls the whole block back.
--   * Every update is keyed on the old value: re-running changes nothing.
--   * Nothing in public/ is deleted; old orders and emails still resolve.
--
-- ROLLBACK
--   Exact: /Users/mustafa/kabia-media-migration/rollback/rollback-switch.sql
--   (generated from the pre-switch snapshot /Users/mustafa/kabia-media-migration/snapshots/pre-switch.json, taken 2026-09-30T00:45:26.058Z;
--   restores each affected row by id, including storage_path, and touches
--   nothing else). Equivalent by mapping: for every entry in /Users/mustafa/kabia-media-migration/mapping.json,
--   set the column back from its "url" to its "old_path" and clear storage_path.
--   Uploaded Storage objects and media_assets rows are additive and harmless to
--   leave in place.
-- ---------------------------------------------------------------------------

do $switch$
declare
  v_map jsonb := '[{"old":"/images/acik-alic1.jpg","url":"https://xlubpolwuseafpcienql.supabase.co/storage/v1/object/public/product-media/products/2026-09/acik-alic1-2f983a09.jpg","path":"products/2026-09/acik-alic1-2f983a09.jpg"},{"old":"/images/acik-badem.jpg","url":"https://xlubpolwuseafpcienql.supabase.co/storage/v1/object/public/product-media/products/2026-09/acik-badem-135ecb48.jpg","path":"products/2026-09/acik-badem-135ecb48.jpg"},{"old":"/images/acik-bal1.jpg","url":"https://xlubpolwuseafpcienql.supabase.co/storage/v1/object/public/product-media/products/2026-09/acik-bal1-ae7bbef5.jpg","path":"products/2026-09/acik-bal1-ae7bbef5.jpg"},{"old":"/images/acik-ceviz1.jpg","url":"https://xlubpolwuseafpcienql.supabase.co/storage/v1/object/public/product-media/products/2026-09/acik-ceviz1-d70dd232.jpg","path":"products/2026-09/acik-ceviz1-d70dd232.jpg"},{"old":"/images/acik-domates1.jpg","url":"https://xlubpolwuseafpcienql.supabase.co/storage/v1/object/public/product-media/products/2026-09/acik-domates1-9397141f.jpg","path":"products/2026-09/acik-domates1-9397141f.jpg"},{"old":"/images/acik-elmasirkesi1.jpg","url":"https://xlubpolwuseafpcienql.supabase.co/storage/v1/object/public/product-media/products/2026-09/acik-elmasirkesi1-3691c257.jpg","path":"products/2026-09/acik-elmasirkesi1-3691c257.jpg"},{"old":"/images/acik-eriste1.jpg","url":"https://xlubpolwuseafpcienql.supabase.co/storage/v1/object/public/product-media/products/2026-09/acik-eriste1-0b887bb5.jpg","path":"products/2026-09/acik-eriste1-0b887bb5.jpg"},{"old":"/images/acik-findik1.jpg","url":"https://xlubpolwuseafpcienql.supabase.co/storage/v1/object/public/product-media/products/2026-09/acik-findik1-e093b2e7.jpg","path":"products/2026-09/acik-findik1-e093b2e7.jpg"},{"old":"/images/acik-ihlamur1.jpg","url":"https://xlubpolwuseafpcienql.supabase.co/storage/v1/object/public/product-media/products/2026-09/acik-ihlamur1-8591247d.jpg","path":"products/2026-09/acik-ihlamur1-8591247d.jpg"},{"old":"/images/acik-tarhana1.jpg","url":"https://xlubpolwuseafpcienql.supabase.co/storage/v1/object/public/product-media/products/2026-09/acik-tarhana1-4dfa2c99.jpg","path":"products/2026-09/acik-tarhana1-4dfa2c99.jpg"},{"old":"/images/catlakkabuk.jpg","url":"https://xlubpolwuseafpcienql.supabase.co/storage/v1/object/public/product-media/journal/2026-09/catlakkabuk-cbf4e0d2.jpg","path":"journal/2026-09/catlakkabuk-cbf4e0d2.jpg"},{"old":"/images/file-badem.jpg","url":"https://xlubpolwuseafpcienql.supabase.co/storage/v1/object/public/product-media/products/2026-09/file-badem-8f35c257.jpg","path":"products/2026-09/file-badem-8f35c257.jpg"},{"old":"/images/gunluk-2026-03-01-subat-kis.jpeg","url":"https://xlubpolwuseafpcienql.supabase.co/storage/v1/object/public/product-media/journal/2026-09/gunluk-2026-03-01-subat-kis-7498d134.jpg","path":"journal/2026-09/gunluk-2026-03-01-subat-kis-7498d134.jpg"},{"old":"/images/gunluk-2026-04-01-tomurcuk.jpeg","url":"https://xlubpolwuseafpcienql.supabase.co/storage/v1/object/public/product-media/journal/2026-09/gunluk-2026-04-01-tomurcuk-186e0d29.jpg","path":"journal/2026-09/gunluk-2026-04-01-tomurcuk-186e0d29.jpg"},{"old":"/images/gunluk-2026-04-10-bakla.jpeg","url":"https://xlubpolwuseafpcienql.supabase.co/storage/v1/object/public/product-media/journal/2026-09/gunluk-2026-04-10-bakla-2af795b0.jpg","path":"journal/2026-09/gunluk-2026-04-10-bakla-2af795b0.jpg"},{"old":"/images/gunluk-2026-04-11-mayis-tomurcuk.jpeg","url":"https://xlubpolwuseafpcienql.supabase.co/storage/v1/object/public/product-media/journal/2026-09/gunluk-2026-04-11-mayis-tomurcuk-d5f4274d.jpg","path":"journal/2026-09/gunluk-2026-04-11-mayis-tomurcuk-d5f4274d.jpg"},{"old":"/images/kabia-badem.jpeg","url":"https://xlubpolwuseafpcienql.supabase.co/storage/v1/object/public/product-media/producers/2026-09/kabia-badem-34c2143a.jpg","path":"producers/2026-09/kabia-badem-34c2143a.jpg"},{"old":"/images/kavanoz-alic.jpg","url":"https://xlubpolwuseafpcienql.supabase.co/storage/v1/object/public/product-media/products/2026-09/kavanoz-alic-7ea2bb0a.jpg","path":"products/2026-09/kavanoz-alic-7ea2bb0a.jpg"},{"old":"/images/kavanoz-bal.jpg","url":"https://xlubpolwuseafpcienql.supabase.co/storage/v1/object/public/product-media/products/2026-09/kavanoz-bal-18d4c682.jpg","path":"products/2026-09/kavanoz-bal-18d4c682.jpg"},{"old":"/images/kavanoz-elma.jpg","url":"https://xlubpolwuseafpcienql.supabase.co/storage/v1/object/public/product-media/products/2026-09/kavanoz-elma-0e7044a1.jpg","path":"products/2026-09/kavanoz-elma-0e7044a1.jpg"},{"old":"/images/kavanoz-salca.jpg","url":"https://xlubpolwuseafpcienql.supabase.co/storage/v1/object/public/product-media/products/2026-09/kavanoz-salca-088d4d5b.jpg","path":"products/2026-09/kavanoz-salca-088d4d5b.jpg"},{"old":"/images/organik-sertifika.jpg","url":"https://xlubpolwuseafpcienql.supabase.co/storage/v1/object/public/product-media/products/2026-09/organik-sertifika-aa6ca3fd.jpg","path":"products/2026-09/organik-sertifika-aa6ca3fd.jpg"},{"old":"/images/paketli-ceviz.jpg","url":"https://xlubpolwuseafpcienql.supabase.co/storage/v1/object/public/product-media/products/2026-09/paketli-ceviz-008288f4.jpg","path":"products/2026-09/paketli-ceviz-008288f4.jpg"},{"old":"/images/paketli-eriste.jpg","url":"https://xlubpolwuseafpcienql.supabase.co/storage/v1/object/public/product-media/products/2026-09/paketli-eriste-01ebf8af.jpg","path":"products/2026-09/paketli-eriste-01ebf8af.jpg"},{"old":"/images/paketli-findik.jpg","url":"https://xlubpolwuseafpcienql.supabase.co/storage/v1/object/public/product-media/products/2026-09/paketli-findik-480c2857.jpg","path":"products/2026-09/paketli-findik-480c2857.jpg"},{"old":"/images/paketli-ihlamur.jpg","url":"https://xlubpolwuseafpcienql.supabase.co/storage/v1/object/public/product-media/products/2026-09/paketli-ihlamur-a0907266.jpg","path":"products/2026-09/paketli-ihlamur-a0907266.jpg"},{"old":"/images/paketli-tarhana.jpg","url":"https://xlubpolwuseafpcienql.supabase.co/storage/v1/object/public/product-media/products/2026-09/paketli-tarhana-5ab4ec02.jpg","path":"products/2026-09/paketli-tarhana-5ab4ec02.jpg"},{"old":"/images/yesilbadem.jpg","url":"https://xlubpolwuseafpcienql.supabase.co/storage/v1/object/public/product-media/journal/2026-09/yesilbadem-d872abff.jpg","path":"journal/2026-09/yesilbadem-d872abff.jpg"}]'::jsonb;
  v_n integer;
begin
  if exists (
    select 1 from jsonb_to_recordset(v_map) as m(old text, url text, path text)
    where not exists (
      select 1 from public.media_assets a
      where a.bucket_id = 'product-media' and a.object_path = m.path and a.deleted_at is null
    )
  ) then
    raise exception 'Switch refused: a target asset is not catalogued in media_assets';
  end if;

  update public.products p
     set main_image_url = m.url
    from jsonb_to_recordset(v_map) as m(old text, url text, path text)
   where p.main_image_url = m.old;
  get diagnostics v_n = row_count;
  raise notice 'products rewritten: %', v_n;

  update public.product_images pi
     set image_url = m.url, storage_path = m.path
    from jsonb_to_recordset(v_map) as m(old text, url text, path text)
   where pi.image_url = m.old;
  get diagnostics v_n = row_count;
  raise notice 'product_images rewritten: %', v_n;

  update public.producers pr
     set photo_url = m.url
    from jsonb_to_recordset(v_map) as m(old text, url text, path text)
   where pr.photo_url = m.old;
  get diagnostics v_n = row_count;
  raise notice 'producers rewritten: %', v_n;

  update public.journal_entries j
     set cover_image_url = m.url
    from jsonb_to_recordset(v_map) as m(old text, url text, path text)
   where j.cover_image_url = m.old;
  get diagnostics v_n = row_count;
  raise notice 'journal_entries rewritten: %', v_n;

  update public.journal_entry_images ji
     set image_url = m.url, storage_path = m.path
    from jsonb_to_recordset(v_map) as m(old text, url text, path text)
   where ji.image_url = m.old;
  get diagnostics v_n = row_count;
  raise notice 'journal_entry_images rewritten: %', v_n;

  if exists (select 1 from public.products p join jsonb_to_recordset(v_map) as m(old text, url text, path text) on p.main_image_url = m.old)
     or exists (select 1 from public.product_images pi join jsonb_to_recordset(v_map) as m(old text, url text, path text) on pi.image_url = m.old)
     or exists (select 1 from public.producers pr join jsonb_to_recordset(v_map) as m(old text, url text, path text) on pr.photo_url = m.old)
     or exists (select 1 from public.journal_entries j join jsonb_to_recordset(v_map) as m(old text, url text, path text) on j.cover_image_url = m.old)
     or exists (select 1 from public.journal_entry_images ji join jsonb_to_recordset(v_map) as m(old text, url text, path text) on ji.image_url = m.old) then
    raise exception 'Switch aborted: some references still point at the old local paths';
  end if;
end
$switch$;
