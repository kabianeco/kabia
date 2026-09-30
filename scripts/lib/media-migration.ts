/**
 * The pure core of the one-time move of content images from public/ to Supabase
 * Storage: which files move and where, what they are called, whether the mapping
 * is complete, and the SQL that switches (and, if needed, undoes) the database
 * references. The scripts that touch Storage and the database are thin shells
 * around this, so the parts that decide things can be tested.
 *
 * No imports from the app beyond two dependency-free modules, so it runs under
 * plain `node` (Node 22.6+ strips the types).
 */

import { MEDIA_EXTENSIONS, mediaObjectName, mediaStemFromFilename, type MediaFolder } from "../../lib/admin/media.ts"

/**
 * The month written into every migrated object name. Fixed rather than read from
 * the clock: the name has to come out identical on a re-run, including one that
 * happens after midnight on the last day of the month.
 */
export const MIGRATION_MONTH = "2026-09"

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
}

const LOCAL_IMAGE = /^\/images\/[^/]+\.(jpe?g|png|webp|avif)$/i

/** A flat `/images/*` raster file — the only kind of reference this move handles. */
export function isMovableLocalImage(url: string): boolean {
  return LOCAL_IMAGE.test(url)
}

export function mimeForPath(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase() ?? ""
  return MIME_BY_EXTENSION[ext] ?? null
}

// ---- planning ----------------------------------------------------------------------

export interface ReferenceRows {
  products: { id: string; slug: string; name: string; main_image_url: string }[]
  productImages: { id: string; product_id: string; image_url: string; alt_text: string | null; storage_path: string | null }[]
  producers: { id: string; slug: string; name: string; photo_url: string | null }[]
  journalEntries: { id: string; slug: string; entry_date: string; location: string; cover_image_url: string | null }[]
  journalImages: { id: string; entry_id: string; image_url: string; alt_text: string | null; storage_path: string | null }[]
}

export interface MovePlan {
  oldPath: string
  folder: MediaFolder
  altText: string
  usedBy: string[]
}

/** "25 Ağustos 2026 — Kabia Çiftliği": the label the public journal page uses as alt text. */
function journalLabel(isoDate: string, location: string): string {
  const date = new Date(isoDate).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
  return `${date} — ${location}`
}

/**
 * Every unique local file the database references, with where it goes and what
 * to call it.
 *
 * A file several rows share (a product's main image is also its producer's photo)
 * is uploaded once and filed by first use: products/, then producers/, then
 * journal/. Alt text is the gallery's own text if it has any, else the product's
 * name, else the producer's, else the journal entry's date and place.
 */
export function planMoves(rows: ReferenceRows): MovePlan[] {
  interface Acc {
    folders: Set<MediaFolder>
    usedBy: string[]
    galleryAlt: string | null
    productName: string | null
    producerName: string | null
    journalAlt: string | null
  }
  const acc = new Map<string, Acc>()
  const get = (path: string): Acc => {
    let entry = acc.get(path)
    if (!entry) {
      entry = { folders: new Set(), usedBy: [], galleryAlt: null, productName: null, producerName: null, journalAlt: null }
      acc.set(path, entry)
    }
    return entry
  }

  const productById = new Map(rows.products.map((p) => [p.id, p]))
  const entryById = new Map(rows.journalEntries.map((e) => [e.id, e]))

  for (const product of rows.products) {
    if (!isMovableLocalImage(product.main_image_url)) continue
    const entry = get(product.main_image_url)
    entry.folders.add("products")
    entry.usedBy.push(`product:${product.slug}`)
    entry.productName ??= product.name
  }
  for (const image of rows.productImages) {
    if (!isMovableLocalImage(image.image_url)) continue
    const product = productById.get(image.product_id)
    const entry = get(image.image_url)
    entry.folders.add("products")
    if (product && !entry.usedBy.includes(`product:${product.slug}`)) entry.usedBy.push(`product:${product.slug}`)
    entry.galleryAlt ??= image.alt_text?.trim() || null
    if (product) entry.productName ??= product.name
  }
  for (const producer of rows.producers) {
    if (!producer.photo_url || !isMovableLocalImage(producer.photo_url)) continue
    const entry = get(producer.photo_url)
    entry.folders.add("producers")
    entry.usedBy.push(`producer:${producer.slug}`)
    entry.producerName ??= producer.name
  }
  for (const journal of rows.journalEntries) {
    if (!journal.cover_image_url || !isMovableLocalImage(journal.cover_image_url)) continue
    const entry = get(journal.cover_image_url)
    entry.folders.add("journal")
    entry.usedBy.push(`journal:${journal.slug}`)
    entry.journalAlt ??= journalLabel(journal.entry_date, journal.location)
  }
  for (const image of rows.journalImages) {
    if (!isMovableLocalImage(image.image_url)) continue
    const journal = entryById.get(image.entry_id)
    const entry = get(image.image_url)
    entry.folders.add("journal")
    if (journal && !entry.usedBy.includes(`journal:${journal.slug}`)) entry.usedBy.push(`journal:${journal.slug}`)
    if (journal) entry.journalAlt ??= journalLabel(journal.entry_date, journal.location)
    entry.galleryAlt ??= image.alt_text?.trim() || null
  }

  return [...acc.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([oldPath, entry]) => ({
      oldPath,
      folder: entry.folders.has("products") ? "products" : entry.folders.has("producers") ? "producers" : "journal",
      altText: entry.galleryAlt ?? entry.productName ?? entry.producerName ?? entry.journalAlt ?? "",
      usedBy: entry.usedBy,
    }))
}

/** `[folder/]YYYY-MM/<stem>-<first 8 hex of the file's SHA-256>.<ext>`. */
export function objectPathFor(oldPath: string, sha256Hex: string, folder: MediaFolder, month: string = MIGRATION_MONTH): string {
  const mime = mimeForPath(oldPath)
  if (!mime) throw new Error(`unsupported image type: ${oldPath}`)
  return mediaObjectName({
    stem: mediaStemFromFilename(oldPath.split("/").pop() ?? oldPath),
    suffix: sha256Hex.slice(0, 8),
    ext: MEDIA_EXTENSIONS[mime],
    folder,
    month,
  })
}

// ---- the mapping file --------------------------------------------------------------

export interface MappingEntry {
  old_path: string
  object_path: string
  url: string
  media_asset_id: string
  sha256: string
  bytes: number
  mime: string
  width: number | null
  height: number | null
  alt_text: string
  folder: MediaFolder
  used_by: string[]
}

const ALLOWED_MIME = new Set(Object.keys(MEDIA_EXTENSIONS))

/**
 * Everything that would make switching from this mapping unsafe. An empty list
 * means the mapping is complete and internally consistent.
 */
export function validateMapping(entries: readonly MappingEntry[], referencedOldPaths: readonly string[], publicBase: string): string[] {
  const problems: string[] = []
  const base = publicBase.replace(/\/$/, "")
  const seen = new Set<string>()
  for (const entry of entries) {
    if (seen.has(entry.old_path)) problems.push(`duplicate mapping for ${entry.old_path}`)
    seen.add(entry.old_path)
    if (!isMovableLocalImage(entry.old_path)) problems.push(`${entry.old_path}: not a movable local image`)
    if (entry.url !== `${base}/${entry.object_path}`) problems.push(`${entry.old_path}: url is not the public base + object path`)
    if (!ALLOWED_MIME.has(entry.mime)) problems.push(`${entry.old_path}: mime ${entry.mime} is not allowed`)
    if (!/^[0-9a-f]{64}$/.test(entry.sha256)) problems.push(`${entry.old_path}: sha256 is not 64 hex characters`)
    if (!Number.isInteger(entry.bytes) || entry.bytes <= 0) problems.push(`${entry.old_path}: bytes must be a positive integer`)
    if (!entry.media_asset_id) problems.push(`${entry.old_path}: no media_assets id`)
  }
  for (const path of referencedOldPaths) {
    if (!seen.has(path)) problems.push(`${path} is referenced by the database but has no mapping`)
  }
  return problems
}

// ---- the switch and its undo -------------------------------------------------------

const sqlText = (value: string) => `'${value.replace(/'/g, "''")}'`

/**
 * One atomic block that rewrites every content reference from the local path to
 * the Storage URL, and fills `storage_path` where the table has that column.
 *
 * Every update is keyed on the old value, so a second run matches nothing and
 * changes nothing. Before writing it checks that each target is a live,
 * catalogued asset; after writing it checks that no old value survived anywhere.
 * Either check failing raises, which rolls the whole block back.
 */
export function buildSwitchSql(entries: readonly MappingEntry[]): string {
  const map = JSON.stringify(entries.map((e) => ({ old: e.old_path, url: e.url, path: e.object_path })))
  const recordset = "jsonb_to_recordset(v_map) as m(old text, url text, path text)"
  const survivors = [
    `select 1 from public.products p join ${recordset} on p.main_image_url = m.old`,
    `select 1 from public.product_images pi join ${recordset} on pi.image_url = m.old`,
    `select 1 from public.producers pr join ${recordset} on pr.photo_url = m.old`,
    `select 1 from public.journal_entries j join ${recordset} on j.cover_image_url = m.old`,
    `select 1 from public.journal_entry_images ji join ${recordset} on ji.image_url = m.old`,
  ]
  return `do $switch$
declare
  v_map jsonb := ${sqlText(map)}::jsonb;
  v_n integer;
begin
  if exists (
    select 1 from ${recordset}
    where not exists (
      select 1 from public.media_assets a
      where a.bucket_id = 'product-media' and a.object_path = m.path and a.deleted_at is null
    )
  ) then
    raise exception 'Switch refused: a target asset is not catalogued in media_assets';
  end if;

  update public.products p
     set main_image_url = m.url
    from ${recordset}
   where p.main_image_url = m.old;
  get diagnostics v_n = row_count;
  raise notice 'products rewritten: %', v_n;

  update public.product_images pi
     set image_url = m.url, storage_path = m.path
    from ${recordset}
   where pi.image_url = m.old;
  get diagnostics v_n = row_count;
  raise notice 'product_images rewritten: %', v_n;

  update public.producers pr
     set photo_url = m.url
    from ${recordset}
   where pr.photo_url = m.old;
  get diagnostics v_n = row_count;
  raise notice 'producers rewritten: %', v_n;

  update public.journal_entries j
     set cover_image_url = m.url
    from ${recordset}
   where j.cover_image_url = m.old;
  get diagnostics v_n = row_count;
  raise notice 'journal_entries rewritten: %', v_n;

  update public.journal_entry_images ji
     set image_url = m.url, storage_path = m.path
    from ${recordset}
   where ji.image_url = m.old;
  get diagnostics v_n = row_count;
  raise notice 'journal_entry_images rewritten: %', v_n;

  if ${survivors.map((q) => `exists (${q})`).join("\n     or ")} then
    raise exception 'Switch aborted: some references still point at the old local paths';
  end if;
end
$switch$;`
}

export interface SwitchSnapshot {
  products: { id: string; main_image_url: string }[]
  product_images: { id: string; image_url: string; storage_path: string | null }[]
  producers: { id: string; photo_url: string | null }[]
  journal_entries: { id: string; cover_image_url: string | null }[]
  journal_entry_images: { id: string; image_url: string; storage_path: string | null }[]
}

/**
 * One atomic block that puts every affected row back exactly as the snapshot
 * recorded it, keyed on the row id. It restores whatever was there, including
 * a null storage_path, so a rollback is not an approximation.
 */
export function buildRollbackSql(snapshot: SwitchSnapshot): string {
  const literal = sqlText(JSON.stringify(snapshot))
  return `do $rollback$
declare
  v jsonb := ${literal}::jsonb;
begin
  update public.products p
     set main_image_url = r.main_image_url
    from jsonb_to_recordset(v -> 'products') as r(id uuid, main_image_url text)
   where p.id = r.id;

  update public.product_images pi
     set image_url = r.image_url, storage_path = r.storage_path
    from jsonb_to_recordset(v -> 'product_images') as r(id uuid, image_url text, storage_path text)
   where pi.id = r.id;

  update public.producers pr
     set photo_url = r.photo_url
    from jsonb_to_recordset(v -> 'producers') as r(id uuid, photo_url text)
   where pr.id = r.id;

  update public.journal_entries j
     set cover_image_url = r.cover_image_url
    from jsonb_to_recordset(v -> 'journal_entries') as r(id uuid, cover_image_url text)
   where j.id = r.id;

  update public.journal_entry_images ji
     set image_url = r.image_url, storage_path = r.storage_path
    from jsonb_to_recordset(v -> 'journal_entry_images') as r(id uuid, image_url text, storage_path text)
   where ji.id = r.id;
end
$rollback$;`
}
