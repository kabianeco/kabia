# Content images in Supabase Storage, and the journal in the database

Written 2026-09-30, after the move. Companion to `admin-media-architecture.md`
(the media library) and `admin-media-database-changes.md`.

## What moved, what stayed

**Moved to Storage** — images that are content an administrator edits: product main
images and galleries, producer photos, journal images. 28 unique files, byte-identical
to the copies in `public/` (SHA-256 verified against what Storage serves).

**Stayed in `public/`** — design images referenced directly from code: the homepage
hero/poster/video and editorial images, the farm page and timeline, guide, auth and
certificate imagery, the email logo, icons, `og-default.jpg`, and the static fallbacks
in `content/homepage.ts` / `content/producers.ts` (used under `isBrandPreview()` and
as Suspense fallbacks). **Nothing was deleted from `public/`**: old orders snapshot
`/images/…` paths, past emails link to them, and browsers hold carts with them.

Not moved on purpose: the two inactive seed products' picsum placeholders, the three
August test uploads already in the library, and the journal video (below).

## Storage layout

`product-media/[folder/]YYYY-MM/<stem>-<8 hex>.<ext>` — folder is `products`,
`producers` or `journal` for uploads made from those editors; the library page keeps the
bare `YYYY-MM/`. Migrated files use month `2026-09` and a suffix taken from the file's
SHA-256 (so the upload script is idempotent). A file several rows share is uploaded once
and filed under `products/` first, then `producers/`, then `journal/`. Objects carry
`cache-control: public, max-age=31536000`; names are unique and never overwritten.

## The journal

`journal_entries` + `journal_entry_images` (the `product_images` pattern; `cover_image_url`
plays the role of `main_image_url`). RLS: public read of published rows only, admin write;
an entry can only be deleted while unpublished; the slug is immutable after creation
(guard trigger). Entries are ordered by date, as every page always did. Pages read through
a tag-cached `honestCache` reader (`lib/journal.ts`): a failed read is an outage panel /
a refused partial sitemap / an omitted list on the guide, never an empty archive or a 404.

`admin_save_product_images` and `admin_save_journal_images` write the cover/main image and
the whole ordered gallery in **one transaction** (SECURITY INVOKER; RLS and
`has_admin_role()` both apply). The rest of a product save (variants, nutrition) is still
separate statements — making the whole save atomic was out of scope.

## Limits, and why there are two

The bucket accepts 10 MB. The app accepts **4 MB** per upload: a request body over 4.5 MB
never reaches a Vercel function, and Next rejects server-action bodies over 1 MB by
default (`next.config.ts` raises it to 4.5 MB). Before this change any upload over 1 MB
failed with a 413 while the UI promised 10 MB. To accept larger originals, uploads would
have to go straight to Storage (signed upload URLs) instead of through the app.

## Known limitation: journal video

A journal entry's video is a local path (`journal_entries.video_path`, `/images/*.mp4|webm`),
so **a new journal entry with a video cannot be created from admin without a code change**:
the file has to be added to `public/` and deployed, then its path typed in. Moving video
to Storage would take:

1. **Bucket:** add `video/mp4` (and `video/webm`) to `allowed_mime_types` — or, cleaner, a
   separate bucket with its own admin-only write policies and a larger size limit.
2. **CSP:** add `media-src 'self' https://<project>.supabase.co` in `proxy.ts`. There is no
   `media-src` today, so it falls back to `default-src 'self'` and the browser would block
   a Supabase-hosted `<video>`. `tests/security-headers.test.ts` pins the header.
3. **Library:** widen `media_assets.mime_type` (its CHECK allows the four image types),
   `MEDIA_EXTENSIONS`, and `probeImage` (image headers only; video needs an `ftyp`/container
   check), give the grid and picker a video thumbnail, add a type filter, and raise the
   upload cap — video will not fit the 4 MB app cap, so it needs the direct-to-Storage
   upload above.
4. **Journal:** a `video_media` reference (or gallery item kind), usage detection for it,
   and the entry page rendering from a Storage URL.

## The reference switch and how to undo it

Generated from the upload's mapping file by `scripts/build-switch-migration.ts`
(`20260930100000_switch_content_images_to_storage.sql`), one atomic block, keyed on the old
value (re-running changes nothing), refusing to run unless every target is a live
`media_assets` row and aborting if any old path survives. Working files live outside the repo
in `/Users/mustafa/kabia-media-migration/`: `mapping.json` (old path → URL, hashes, sizes),
`snapshots/pre-switch.json` (every affected row), `rollback/rollback-switch.sql` (restores
each row by id from that snapshot, including `storage_path`), and the before/after
screenshots. The upload script is `scripts/upload-content-images.ts` (`--apply`; dry run by
default).

## Files in `public/` no longer referenced

26 files (6.28 MB) are referenced by neither code, tests nor live data. **Do not delete
these until the new code is deployed**: production still runs the old journal, which reads
`gunluk-2026-03-01-subat-kis.jpeg`, `gunluk-2026-04-01-tomurcuk.jpeg`,
`gunluk-2026-04-10-bakla.jpeg`, `gunluk-2026-04-11-mayis-tomurcuk.jpeg` and
`catlakkabuk.jpg` until then. After that deploy:

- 9 gallery-only files moved to Storage: `kavanoz-{alic,bal,elma,salca}.jpg`,
  `paketli-{ceviz,eriste,findik,ihlamur,tarhana}.jpg`.
- 5 journal photos moved to Storage (the five above).
- 12 already unused before this work: `almonds-net.jpg`, `ceviz-bahce.jpeg`,
  `field-tractor.jpg`, `findik1.jpeg`, `findik3.jpeg`, `gunluk-2026-08-25-yesil-kabuk.jpeg`,
  `ihlamur.jpeg`, `kabia-badem2.jpeg`, `kabuklu-ceviz1.jpeg`, `paketli-badem.jpg`,
  `sertifika.jpeg`, `valley-ridge.jpg`.

Referenced only by tests (keep unless the tests change): `kabuklu-badem-acik.jpeg`,
`kabuklu-ceviz.jpeg`, `marina-ilk-dikim.jpeg`, `resim22.jpg`. Still referenced by live
data and must stay: `acik-badem.jpg` (nine order snapshots) and
`gunluk-2026-03-15-kaolin.mp4` (a journal entry's `video_path`).
