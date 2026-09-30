/**
 * Builds the reference-switch migration and its rollback from the upload's
 * mapping file and a snapshot of the affected rows.
 *
 *   node --env-file=.env.local scripts/build-switch-migration.ts --snapshot
 *       reads the five affected tables (SELECT only) and saves them outside the
 *       repo. Refuses if anything already points at a migrated Storage URL, so a
 *       snapshot of an already-switched database can never overwrite the real one.
 *
 *   node --env-file=.env.local scripts/build-switch-migration.ts --build
 *       validates the mapping against the snapshot, then writes
 *         supabase/migrations/<stamp>_switch_content_images_to_storage.sql
 *         /Users/mustafa/kabia-media-migration/rollback/rollback-switch.sql
 *
 * Neither mode writes to the database.
 */

import { createClient } from "@supabase/supabase-js"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { MEDIA_BUCKET, publicMediaUrl } from "../lib/admin/media.ts"
import { buildRollbackSql, buildSwitchSql, isMovableLocalImage, validateMapping, type MappingEntry, type SwitchSnapshot } from "./lib/media-migration.ts"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const WORK_DIR = "/Users/mustafa/kabia-media-migration"
const MAPPING_FILE = path.join(WORK_DIR, "mapping.json")
const SNAPSHOT_FILE = path.join(WORK_DIR, "snapshots", "pre-switch.json")
const ROLLBACK_FILE = path.join(WORK_DIR, "rollback", "rollback-switch.sql")
const MIGRATION_NAME = "20260930100000_switch_content_images_to_storage.sql"

const mode = process.argv.includes("--snapshot") ? "snapshot" : process.argv.includes("--build") ? "build" : null
if (!mode) {
  console.error("usage: build-switch-migration.ts --snapshot | --build")
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error("Missing Supabase env. Run with: node --env-file=.env.local scripts/build-switch-migration.ts ...")
  process.exit(1)
}
const supabase = createClient(url, key, { auth: { persistSession: false } })
const base = publicMediaUrl(url, MEDIA_BUCKET, "").replace(/\/$/, "")

function readMapping(): MappingEntry[] {
  if (!existsSync(MAPPING_FILE)) throw new Error(`no mapping file at ${MAPPING_FILE}; run upload-content-images.ts --apply first`)
  return (JSON.parse(readFileSync(MAPPING_FILE, "utf8")) as { entries: MappingEntry[] }).entries
}

async function readTable<T>(table: string): Promise<T[]> {
  const { data, error } = await supabase.from(table).select("*")
  if (error) throw new Error(`read ${table} failed: ${error.message}`)
  return (data ?? []) as T[]
}

type Full = {
  products: { id: string; main_image_url: string }[]
  product_images: { id: string; image_url: string; storage_path: string | null }[]
  producers: { id: string; photo_url: string | null }[]
  journal_entries: { id: string; cover_image_url: string | null }[]
  journal_entry_images: { id: string; image_url: string; storage_path: string | null }[]
}

function narrow(full: Full): SwitchSnapshot {
  return {
    products: full.products.map((r) => ({ id: r.id, main_image_url: r.main_image_url })),
    product_images: full.product_images.map((r) => ({ id: r.id, image_url: r.image_url, storage_path: r.storage_path })),
    producers: full.producers.map((r) => ({ id: r.id, photo_url: r.photo_url })),
    journal_entries: full.journal_entries.map((r) => ({ id: r.id, cover_image_url: r.cover_image_url })),
    journal_entry_images: full.journal_entry_images.map((r) => ({ id: r.id, image_url: r.image_url, storage_path: r.storage_path })),
  }
}

/** Every value in the snapshot that points somewhere. */
function references(s: SwitchSnapshot): string[] {
  return [
    ...s.products.map((r) => r.main_image_url),
    ...s.product_images.map((r) => r.image_url),
    ...s.producers.map((r) => r.photo_url),
    ...s.journal_entries.map((r) => r.cover_image_url),
    ...s.journal_entry_images.map((r) => r.image_url),
  ].filter((v): v is string => typeof v === "string")
}

async function snapshot() {
  const full: Full = {
    products: await readTable("products"),
    product_images: await readTable("product_images"),
    producers: await readTable("producers"),
    journal_entries: await readTable("journal_entries"),
    journal_entry_images: await readTable("journal_entry_images"),
  }
  const slim = narrow(full)
  const already = references(slim).filter((v) => v.startsWith(base))
  if (already.length) {
    throw new Error(`refusing to snapshot: ${already.length} reference(s) already point at Storage (${already[0]}). The pre-switch snapshot must be taken before the switch.`)
  }
  mkdirSync(path.dirname(SNAPSHOT_FILE), { recursive: true })
  writeFileSync(
    SNAPSHOT_FILE,
    JSON.stringify(
      { taken_at: new Date().toISOString(), counts: Object.fromEntries(Object.entries(full).map(([k, v]) => [k, v.length])), snapshot: slim, full },
      null,
      1,
    ),
  )
  console.log("snapshot written:", SNAPSHOT_FILE)
  for (const [table, rows] of Object.entries(full)) console.log(`  ${table.padEnd(22)} ${rows.length} rows`)
}

function build() {
  const mapping = readMapping()
  if (!existsSync(SNAPSHOT_FILE)) throw new Error(`no snapshot at ${SNAPSHOT_FILE}; run --snapshot first`)
  const { snapshot: slim, taken_at } = JSON.parse(readFileSync(SNAPSHOT_FILE, "utf8")) as { snapshot: SwitchSnapshot; taken_at: string }

  const referencedLocal = [...new Set(references(slim).filter(isMovableLocalImage))].sort()
  const problems = validateMapping(mapping, referencedLocal, base)
  const unused = mapping.filter((e) => !referencedLocal.includes(e.old_path))
  if (unused.length) problems.push(`mapping has ${unused.length} entr(ies) that nothing references: ${unused.map((e) => e.old_path).join(", ")}`)
  if (problems.length) {
    console.error("cannot build:")
    for (const p of problems) console.error("  -", p)
    process.exit(1)
  }

  const counts = Object.fromEntries(
    (Object.keys(slim) as (keyof SwitchSnapshot)[]).map((table) => [
      table,
      slim[table].filter((row) => Object.values(row).some((v) => typeof v === "string" && mapping.some((e) => e.old_path === v))).length,
    ]),
  )

  const header = `-- ---------------------------------------------------------------------------
-- Switch content-image references from public/ paths to Supabase Storage URLs.
--
-- WHAT
--   Rewrites, from the old local path to the new public Storage URL:
--     products.main_image_url, product_images.image_url (+ storage_path),
--     producers.photo_url, journal_entries.cover_image_url,
--     journal_entry_images.image_url (+ storage_path).
--   ${mapping.length} files, ${JSON.stringify(counts)} rows expected to change
--   (rows per table that currently hold a mapped local path).
--   The block is generated from the upload's mapping file
--   (${MAPPING_FILE}) by scripts/build-switch-migration.ts and is one atomic
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
--   Exact: ${ROLLBACK_FILE}
--   (generated from the pre-switch snapshot ${SNAPSHOT_FILE}, taken ${taken_at};
--   restores each affected row by id, including storage_path, and touches
--   nothing else). Equivalent by mapping: for every entry in ${MAPPING_FILE},
--   set the column back from its "url" to its "old_path" and clear storage_path.
--   Uploaded Storage objects and media_assets rows are additive and harmless to
--   leave in place.
-- ---------------------------------------------------------------------------

`
  writeFileSync(path.join(root, "supabase", "migrations", MIGRATION_NAME), header + buildSwitchSql(mapping) + "\n")
  mkdirSync(path.dirname(ROLLBACK_FILE), { recursive: true })
  writeFileSync(ROLLBACK_FILE, `-- Rollback of ${MIGRATION_NAME}, from the snapshot taken ${taken_at}.\n` + buildRollbackSql(slim) + "\n")
  console.log(`migration: supabase/migrations/${MIGRATION_NAME}`)
  console.log(`rollback:  ${ROLLBACK_FILE}`)
  console.log("rows that will change:", counts)
}

try {
  if (mode === "snapshot") await snapshot()
  else build()
} catch (error) {
  console.error("FAILED:", error instanceof Error ? error.message : error)
  process.exit(1)
}
