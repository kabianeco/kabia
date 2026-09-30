/**
 * One-time upload of the content images from public/ to Supabase Storage.
 *
 *   node --env-file=.env.local scripts/upload-content-images.ts            # plan only
 *   node --env-file=.env.local scripts/upload-content-images.ts --apply    # upload
 *
 * What it does:
 *   1. reads the database (SELECT only) for every /images/* file that a product,
 *      product gallery, producer or journal entry points at;
 *   2. uploads each unique file ONCE, byte-for-byte as it is in public/ (nothing
 *      is re-encoded), with its real content type and a one-year cache header;
 *   3. registers it in media_assets with alt text and probed dimensions, created
 *      by the single active super administrator (created_by is NOT NULL and
 *      immutable, and this project has no way to name a system user without
 *      touching auth.*);
 *   4. writes the mapping (old path -> new URL) to a file outside the repo, which
 *      the switch migration is generated from.
 *
 * It is idempotent: object names are derived from the file's SHA-256, so a
 * re-run computes the same names, finds the objects already there, verifies
 * their size, and skips them. It never overwrites and never deletes anything, in
 * Storage or in public/. Without --apply it changes nothing at all.
 *
 * Uses the service-role key from .env.local; the key is never printed.
 */

import { createClient } from "@supabase/supabase-js"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { MEDIA_BUCKET, MEDIA_CACHE_CONTROL, MEDIA_MAX_BYTES, publicMediaUrl } from "../lib/admin/media.ts"
import { probeImage } from "../lib/admin/image-probe.ts"
import {
  MIGRATION_MONTH,
  mimeForPath,
  objectPathFor,
  planMoves,
  validateMapping,
  type MappingEntry,
  type ReferenceRows,
} from "./lib/media-migration.ts"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const WORK_DIR = "/Users/mustafa/kabia-media-migration"
const MAPPING_FILE = path.join(WORK_DIR, "mapping.json")

const apply = process.argv.includes("--apply")

function need(name: string): string {
  const value = process.env[name]
  if (!value) {
    console.error(`Missing ${name}. Run with: node --env-file=.env.local scripts/upload-content-images.ts`)
    process.exit(1)
  }
  return value
}

const url = need("NEXT_PUBLIC_SUPABASE_URL")
const supabase = createClient(url, need("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } })

async function select<T>(table: string, columns: string): Promise<T[]> {
  const { data, error } = await supabase.from(table).select(columns)
  if (error) throw new Error(`read ${table} failed: ${error.message}`)
  return (data ?? []) as T[]
}

async function loadReferences(): Promise<ReferenceRows> {
  const [products, productImages, producers, journalEntries, journalImages] = await Promise.all([
    select<ReferenceRows["products"][number]>("products", "id, slug, name, main_image_url"),
    select<ReferenceRows["productImages"][number]>("product_images", "id, product_id, image_url, alt_text, storage_path"),
    select<ReferenceRows["producers"][number]>("producers", "id, slug, name, photo_url"),
    select<ReferenceRows["journalEntries"][number]>("journal_entries", "id, slug, entry_date, location, cover_image_url"),
    select<ReferenceRows["journalImages"][number]>("journal_entry_images", "id, entry_id, image_url, alt_text, storage_path"),
  ])
  return { products, productImages, producers, journalEntries, journalImages }
}

/** The one active super administrator: the only real user this project has. */
async function loadAttributionUser(): Promise<string> {
  const rows = await select<{ user_id: string; role: string; is_active: boolean }>("user_roles", "user_id, role, is_active")
  const supers = rows.filter((r) => r.role === "super_admin" && r.is_active)
  if (supers.length !== 1) {
    throw new Error(`expected exactly one active super_admin to attribute the uploads to, found ${supers.length}`)
  }
  return supers[0].user_id
}

interface HeadResult {
  status: number
  type: string | null
  length: number | null
  cache: string | null
}

async function head(publicUrl: string): Promise<HeadResult> {
  const res = await fetch(publicUrl, { method: "HEAD" })
  const length = res.headers.get("content-length")
  return {
    status: res.status,
    type: res.headers.get("content-type")?.split(";")[0] ?? null,
    length: length ? Number(length) : null,
    cache: res.headers.get("cache-control"),
  }
}

function readExistingMapping(): MappingEntry[] {
  if (!existsSync(MAPPING_FILE)) return []
  const parsed = JSON.parse(readFileSync(MAPPING_FILE, "utf8")) as { entries?: MappingEntry[] }
  return parsed.entries ?? []
}

async function main() {
  const rows = await loadReferences()
  const plan = planMoves(rows)
  const userId = await loadAttributionUser()
  const existing = new Map(readExistingMapping().map((e) => [e.old_path, e]))

  console.log(`${apply ? "APPLY" : "DRY RUN"} — ${plan.length} unique files to place in bucket "${MEDIA_BUCKET}" (month ${MIGRATION_MONTH})`)

  const entries: MappingEntry[] = []
  const problems: string[] = []

  for (const move of plan) {
    const file = path.join(root, "public", move.oldPath)
    if (!existsSync(file)) {
      problems.push(`${move.oldPath}: not found in public/`)
      continue
    }
    const bytes = readFileSync(file)
    const mime = mimeForPath(move.oldPath)
    if (!mime) {
      problems.push(`${move.oldPath}: unsupported type`)
      continue
    }
    if (bytes.length > MEDIA_MAX_BYTES) {
      problems.push(`${move.oldPath}: ${bytes.length} bytes exceeds the bucket limit`)
      continue
    }
    const probed = probeImage(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + Math.min(bytes.length, 64 * 1024)) as ArrayBuffer)
    if (!probed || probed.format !== mime) {
      problems.push(`${move.oldPath}: bytes are not a ${mime}`)
      continue
    }
    const sha256 = createHash("sha256").update(bytes).digest("hex")
    const objectPath = objectPathFor(move.oldPath, sha256, move.folder)
    const publicUrl = publicMediaUrl(url, MEDIA_BUCKET, objectPath)

    const previous = existing.get(move.oldPath)
    if (previous && previous.sha256 !== sha256) {
      problems.push(`${move.oldPath}: the file changed since it was first mapped (sha256 differs)`)
      continue
    }

    let status = "planned"
    let mediaAssetId = previous?.media_asset_id ?? ""

    if (apply) {
      const { error: uploadError } = await supabase.storage
        .from(MEDIA_BUCKET)
        .upload(objectPath, bytes, { contentType: mime, cacheControl: MEDIA_CACHE_CONTROL, upsert: false })
      if (uploadError) {
        // Already there is fine if it is the very same object; anything else is not.
        const seen = await head(publicUrl)
        if (seen.status === 200 && seen.length === bytes.length && seen.type === mime) {
          status = "already uploaded"
        } else {
          problems.push(`${move.oldPath}: upload failed (${uploadError.message}) and the object is not an identical copy`)
          continue
        }
      } else {
        status = "uploaded"
      }

      const { error: insertError } = await supabase.from("media_assets").upsert(
        {
          bucket_id: MEDIA_BUCKET,
          object_path: objectPath,
          original_filename: move.oldPath.split("/").pop(),
          mime_type: mime,
          file_size: bytes.length,
          width: probed.width,
          height: probed.height,
          alt_text: move.altText || null,
          created_by: userId,
        },
        { onConflict: "bucket_id,object_path", ignoreDuplicates: true },
      )
      if (insertError) {
        problems.push(`${move.oldPath}: catalogue insert failed (${insertError.message})`)
        continue
      }
      const { data: row, error: readError } = await supabase
        .from("media_assets")
        .select("id")
        .eq("bucket_id", MEDIA_BUCKET)
        .eq("object_path", objectPath)
        .single()
      if (readError || !row) {
        problems.push(`${move.oldPath}: catalogue row not readable after insert`)
        continue
      }
      mediaAssetId = row.id as string
    }

    entries.push({
      old_path: move.oldPath,
      object_path: objectPath,
      url: publicUrl,
      media_asset_id: mediaAssetId,
      sha256,
      bytes: bytes.length,
      mime,
      width: probed.width,
      height: probed.height,
      alt_text: move.altText,
      folder: move.folder,
      used_by: move.usedBy,
    })
    console.log(`  ${status.padEnd(16)} ${move.oldPath}  ->  ${objectPath}  (${bytes.length} B, ${probed.width}x${probed.height})`)
  }

  if (problems.length) {
    console.error("\nPROBLEMS — nothing further is safe to do until these are resolved:")
    for (const p of problems) console.error("  -", p)
    process.exit(1)
  }

  if (!apply) {
    console.log("\nDry run only: no upload, no database write, no file written. Re-run with --apply.")
    return
  }

  // Mapping file: outside the repo, and the input to the switch migration.
  const referenced = plan.map((m) => m.oldPath)
  const mappingProblems = validateMapping(entries, referenced, publicMediaUrl(url, MEDIA_BUCKET, "").replace(/\/$/, ""))
  if (mappingProblems.length) {
    console.error("mapping is not consistent:", mappingProblems)
    process.exit(1)
  }
  mkdirSync(WORK_DIR, { recursive: true })
  writeFileSync(
    MAPPING_FILE,
    JSON.stringify({ generated_at: new Date().toISOString(), bucket: MEDIA_BUCKET, month: MIGRATION_MONTH, created_by: userId, entries }, null, 2),
  )
  console.log(`\nmapping written: ${MAPPING_FILE} (${entries.length} entries)`)

  // Every new URL must answer 200 with the right type and the exact size.
  let bad = 0
  for (const entry of entries) {
    const seen = await head(entry.url)
    const ok = seen.status === 200 && seen.type === entry.mime && seen.length === entry.bytes
    if (!ok) bad++
    console.log(`  ${ok ? "OK " : "BAD"} ${seen.status} ${seen.type} ${seen.length} ${seen.cache ?? "-"}  ${entry.object_path}`)
  }
  if (bad) {
    console.error(`${bad} object(s) did not verify`)
    process.exit(1)
  }
  console.log("all objects verified: 200, correct content type and size")
}

main().catch((error) => {
  console.error("FAILED:", error instanceof Error ? error.message : error)
  process.exit(1)
})
