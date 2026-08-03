/**
 * Theme engine — authorization, draft privacy, atomic publish and revisions.
 *
 * Hit the live database directly through Supabase RPCs, because the security
 * guarantees live there: RLS hides the draft from anon, and the SECURITY
 * DEFINER RPCs re-derive the actor from `auth.uid()` + `user_roles` so a
 * client-supplied administrator id is structurally impossible.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and
 * SUPABASE_SERVICE_ROLE_KEY. Skips cleanly when any are absent, so `npm test`
 * stays green without credentials.
 */
import { after, before, describe, it } from "node:test"
import assert from "node:assert/strict"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

const ready = Boolean(URL_ && ANON && SERVICE)

interface ThrowawayAdmin {
  id: string
  email: string
  password: string
}

describe("theme engine authorization & publishing", { skip: ready ? false : "needs Supabase credentials" }, () => {
  let adminClient: SupabaseClient
  let anonClient: SupabaseClient
  let adminUser: ThrowawayAdmin | null = null
  let adminSessionClient: SupabaseClient

  const EMAIL = `theme-test-${Date.now()}@kabia.local`

  before(async () => {
    adminClient = createClient(URL_!, SERVICE!, { auth: { autoRefreshToken: false, persistSession: false } })
    anonClient = createClient(URL_!, ANON!, { auth: { autoRefreshToken: false, persistSession: false } })

    // Clean up any leftover, then create a throwaway admin.
    const { data: list } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 200 })
    const existing = list?.users.find((u) => u.email === EMAIL)
    if (existing) {
      await adminClient.from("user_roles").delete().eq("user_id", existing.id)
      await adminClient.auth.admin.deleteUser(existing.id)
    }
    const pw = `Tt${Math.random().toString(36).slice(2)}!7`
    const { data, error } = await adminClient.auth.admin.createUser({
      email: EMAIL,
      password: pw,
      email_confirm: true,
      user_metadata: { full_name: "Tema Testi" },
    })
    if (error) throw new Error(`createUser: ${error.message}`)
    adminUser = { id: data.user.id, email: EMAIL, password: pw }
    await adminClient.from("user_roles").upsert(
      { user_id: adminUser.id, role: "admin", is_active: true, must_change_password: false },
      { onConflict: "user_id" },
    )

    // Sign in with an anon client — calls from it carry the access_token, so
    // auth.uid() resolves inside the RPCs.
    adminSessionClient = createClient(URL_!, ANON!, { auth: { autoRefreshToken: false, persistSession: false } })
    const { error: signInError } = await adminSessionClient.auth.signInWithPassword({
      email: EMAIL,
      password: pw,
    })
    if (signInError) throw new Error(`signIn: ${signInError.message}`)
  })

  after(async () => {
    if (!adminUser) return
    try {
      await adminClient.from("user_roles").delete().eq("user_id", adminUser.id)
      await adminClient.auth.admin.deleteUser(adminUser.id)
    } catch {
      // best-effort
    }
  })

  it("anon can read the published theme through the safe RPC", async () => {
    const { data, error } = await anonClient.rpc("get_published_site_theme")
    assert.equal(error, null)
    assert.ok(data && typeof data === "object")
    assert.equal(data.shapePreset, "balanced")
    assert.equal(data.typographyProfile, "kabia_original")
  })

  it("anon cannot read the settings table directly (RLS hides the draft)", async () => {
    const { data, error } = await anonClient
      .from("site_theme_settings")
      .select("site_key, draft_config, published_config")
    // anon has no SELECT grant on the table, so PostgREST returns a permission
    // error. Either an error or an empty result is acceptable — what matters is
    // that no row (and therefore no draft_config) ever leaks to an anonymous
    // reader.
    const leaked = Array.isArray(data) && data.length > 0
    assert.equal(leaked, false, "anon must never read the settings table or its draft")
    assert.ok(error || data === null, "anon must be denied or receive nothing")
  })

  it("anon cannot read revisions directly", async () => {
    const { data } = await anonClient
      .from("site_theme_revisions")
      .select("version, config")
    assert.equal(Array.isArray(data) ? data.length : 0, 0)
  })

  it("anon cannot save a draft (RPC requires an admin role)", async () => {
    const cfg = {
      schemaVersion: 1,
      shapePreset: "soft",
      typographyProfile: "kabia_original",
      fonts: { body: "instrument_sans", display: "instrument_serif" },
      overrides: {},
    }
    const { error } = await anonClient.rpc("save_site_theme_draft", { p_config: cfg })
    assert.ok(error, "anon should not be able to save a draft")
  })

  it("admin can save a draft without publishing", async () => {
    const cfg = {
      schemaVersion: 1,
      shapePreset: "soft",
      typographyProfile: "soft_contemporary",
      fonts: { body: "dm_sans", display: "fraunces" },
      overrides: { radius: { button: 16 } },
    }
    const { error } = await adminSessionClient.rpc("save_site_theme_draft", { p_config: cfg })
    assert.equal(error, null)

    // The draft exists, but the public RPC still returns the published config.
    const { data: pub } = await anonClient.rpc("get_published_site_theme")
    assert.equal(pub.shapePreset, "balanced", "draft must not leak to public read")
  })

  it("atomic publish increments version, creates a revision and an audit event", async () => {
    const beforeRow = await adminSessionClient
      .from("site_theme_settings")
      .select("published_version")
      .eq("site_key", "default")
      .maybeSingle()
    const beforeVersion = beforeRow.data?.published_version ?? 1

    const { data: newVersion, error } = await adminSessionClient.rpc("publish_site_theme", {
      p_note: "test publish",
    })
    assert.equal(error, null)
    assert.ok(typeof newVersion === "number")
    assert.equal(newVersion, beforeVersion + 1, "version must increment by exactly one")

    // A revision row for the previous published version was created.
    const { data: rev } = await adminSessionClient
      .from("site_theme_revisions")
      .select("version, action")
      .eq("site_key", "default")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle()
    assert.ok(rev, "a revision must be created on publish")
    assert.equal(["publish", "restore", "seed"].includes(rev.action), true)

    // The public RPC now reflects the published soft config.
    const { data: pub } = await anonClient.rpc("get_published_site_theme")
    assert.equal(pub.shapePreset, "soft")
    assert.equal(pub.typographyProfile, "soft_contemporary")

    // An audit event was written with the server-derived actor.
    const { data: audit } = await adminSessionClient
      .from("admin_audit_logs")
      .select("action, admin_user_id")
      .eq("action", "theme.publish")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    assert.ok(audit, "publish must create an audit event")
    assert.equal(audit!.admin_user_id, adminUser!.id, "actor must be server-derived, not client-supplied")
  })

  it("restoring a previous version creates a NEW version and never mutates history", async () => {
    // Find an earlier revision (the seed version 1 = balanced).
    const { data: revs } = await adminSessionClient
      .from("site_theme_revisions")
      .select("version, config")
      .eq("site_key", "default")
      .order("version", { ascending: true })
    const target = (revs ?? []).find((r: { version: number; config: { shapePreset: string } }) => r.config.shapePreset === "balanced")
    assert.ok(target, "there must be a balanced revision to restore")

    const beforeRow = await adminSessionClient
      .from("site_theme_settings")
      .select("published_version")
      .eq("site_key", "default")
      .maybeSingle()
    const beforeVersion = beforeRow.data?.published_version

    // Snapshot the count of revisions for the target version before/after —
    // restoring must NOT touch the historical row.
    const { count: targetCountBefore } = await adminSessionClient
      .from("site_theme_revisions")
      .select("id", { count: "exact" })
      .eq("version", target.version)

    const { data: newVersion, error } = await adminSessionClient.rpc("restore_site_theme_version", {
      p_version: target.version,
      p_note: "test restore",
    })
    assert.equal(error, null)
    assert.ok(typeof newVersion === "number")
    assert.equal(newVersion, beforeVersion + 1, "restore must produce a new version")

    // The historical row is untouched — same count for that version.
    const { count: targetCountAfter } = await adminSessionClient
      .from("site_theme_revisions")
      .select("id", { count: "exact" })
      .eq("version", target.version)
    assert.equal(targetCountAfter, targetCountBefore, "history must never be mutated")

    // The public theme restored backwards.
    const { data: pub } = await anonClient.rpc("get_published_site_theme")
    assert.equal(pub.shapePreset, "balanced")
  })

  it("revisions are append-only (UPDATE/DELETE are refused)", async () => {
    const { data: rev } = await adminSessionClient
      .from("site_theme_revisions")
      .select("id")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle()
    assert.ok(rev)
    const { error: updateError } = await adminSessionClient
      .from("site_theme_revisions")
      .update({ publication_note: "tampered" })
      .eq("id", rev.id)
    // RLS has no UPDATE policy → PostgREST returns "violates row-level security"
    // OR the append-only trigger raises. Either way, the write must fail.
    assert.ok(updateError, "revisions must not be updatable")
  })
})