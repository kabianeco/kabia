"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath, updateTag } from "next/cache"
import { adminContext } from "@/lib/admin/auth"
import { logAdminAction, AUDIT_WARNING } from "@/lib/admin/audit"
import { toActionState, type ActionState } from "@/lib/admin/errors"
import { parseThemeConfig } from "@/lib/theme-engine/schema"
import { createAppearancePreviewToken } from "@/lib/theme-engine/preview-cookie"
import { SITE_THEME_TAG } from "@/lib/theme-settings"

/**
 * Appearance-editor mutations. Each re-derives the operator from the session
 * (`adminContext("manageTheme")`), validates the configuration against the Zod
 * schema, calls the trusted SECURITY DEFINER RPC, writes an audit event with
 * the server-derived identity, and revalidates the storefront + admin routes
 * (and busts the theme cache tag, exactly like the settings flow uses
 * `updateTag(SETTINGS_TAG)`).
 *
 * Draft privacy is enforced at the database boundary: the RPCs re-check the
 * caller's `user_roles` row inside their own body, and the only anon-readable
 * function returns the published configuration alone.
 */

const PREVIEW_COOKIE = "kabia_appearance_preview"

interface ActionResult {
  ok: boolean
  message?: string
  fieldErrors?: Record<string, string>
  warning?: string
  /** Returned by publish/restore so the editor can show the new version. */
  version?: number
}

/** Save the working draft. Does NOT publish, does NOT touch the public site. */
export async function saveDraftAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const { supabase } = await adminContext("manageTheme")

    const raw = formData.get("config")
    if (typeof raw !== "string") return { ok: false, message: "Yapılandırma eksik." }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return { ok: false, message: "Yapılandırma okunamadı." }
    }

    const config = parseThemeConfig(parsed)
    if (!config) return { ok: false, message: "Tema yapılandırması geçersiz; onaylı değerler dışında bir değer var." }

    const { error } = await supabase.rpc("save_site_theme_draft", { p_config: config })
    if (error) return toActionState(error, "saveDraft")

    const audited = await logAdminAction(supabase, {
      action: "theme.draft_save",
      entityType: "theme",
      entityId: "default",
      metadata: {
        shapePreset: config.shapePreset,
        typographyProfile: config.typographyProfile,
        bodyFont: config.fonts.body,
        displayFont: config.fonts.display,
      },
    })

    revalidatePath("/admin/appearance")
    return {
      ok: true,
      message: "Taslak kaydedildi. Yayınlayana kadar mağazaya yansımaz.",
      warning: audited ? undefined : AUDIT_WARNING,
    }
  } catch (error) {
    return toActionState(error, "saveDraft")
  }
}

/** Discard the draft (form action). Redirects so the editor resets to published. */
export async function discardDraftFormAction(): Promise<void> {
  const { supabase } = await adminContext("manageTheme")
  const { error } = await supabase.rpc("discard_site_theme_draft")
  if (error) throw error
  revalidatePath("/admin/appearance")
  redirect("/admin/appearance?geri=1")
}

/** Publish the current draft atomically; the RPC snapshots a revision. */
export async function publishThemeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const { supabase } = await adminContext("manageTheme")
    const note = (formData.get("note") as string | null)?.trim() || null

    const { data, error } = await supabase.rpc("publish_site_theme", { p_note: note })
    if (error) return toActionState(error, "publishTheme")
    const newVersion = typeof data === "number" ? data : undefined

    updateTag(SITE_THEME_TAG)
    revalidatePath("/", "layout")
    revalidatePath("/shop")
    revalidatePath("/magaza")
    revalidatePath("/admin/appearance")
    revalidatePath("/admin/appearance/preview")

    return {
      ok: true,
      message: `Tema yayınlandı${newVersion ? ` (sürüm ${newVersion})` : ""}. Mağazaya yansıtıldı.`,
      version: newVersion,
    }
  } catch (error) {
    return toActionState(error, "publishTheme")
  }
}

/** Form-action variant of publish, used by the confirmation dialog. Redirects. */
export async function publishThemeFormAction(formData: FormData): Promise<void> {
  const { supabase } = await adminContext("manageTheme")
  const note = (formData.get("note") as string | null)?.trim() || null
  const { error } = await supabase.rpc("publish_site_theme", { p_note: note })
  if (error) throw error
  updateTag(SITE_THEME_TAG)
  revalidatePath("/", "layout")
  revalidatePath("/shop")
  revalidatePath("/magaza")
  revalidatePath("/admin/appearance")
  revalidatePath("/admin/appearance/preview")
  redirect("/admin/appearance?yayin=1")
}

/** Restore a previous published version; the RPC copies it forward as a new version. */
export async function restoreRevisionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const { supabase } = await adminContext("manageTheme")
    const versionRaw = formData.get("version")
    const version = Number(versionRaw)
    if (!Number.isInteger(version) || version < 1) {
      return { ok: false, message: "Geçersiz sürüm." }
    }
    const note = (formData.get("note") as string | null)?.trim() || `Sürüm ${version} geri yüklendi.`

    const { data, error } = await supabase.rpc("restore_site_theme_version", {
      p_version: version,
      p_note: note,
    })
    if (error) return toActionState(error, "restoreRevision")
    const newVersion = typeof data === "number" ? data : undefined

    updateTag(SITE_THEME_TAG)
    revalidatePath("/", "layout")
    revalidatePath("/shop")
    revalidatePath("/magaza")
    revalidatePath("/admin/appearance")
    revalidatePath("/admin/appearance/preview")

    return {
      ok: true,
      message: `Sürüm ${version} geri yüklendi${newVersion ? `; yeni sürüm ${newVersion}` : ""}. Mağazaya yansıtıldı.`,
      version: newVersion,
    }
  } catch (error) {
    return toActionState(error, "restoreRevision")
  }
}

/** Form-action variant of restore, used by the revision-history confirmation. */
export async function restoreRevisionFormAction(formData: FormData): Promise<void> {
  const { supabase } = await adminContext("manageTheme")
  const version = Number(formData.get("version"))
  if (!Number.isInteger(version) || version < 1) throw new Error("Geçersiz sürüm.")
  const note = (formData.get("note") as string | null)?.trim() || `Sürüm ${version} geri yüklendi.`
  const { error } = await supabase.rpc("restore_site_theme_version", { p_version: version, p_note: note })
  if (error) throw error
  updateTag(SITE_THEME_TAG)
  revalidatePath("/", "layout")
  revalidatePath("/shop")
  revalidatePath("/magaza")
  revalidatePath("/admin/appearance")
  revalidatePath("/admin/appearance/preview")
  redirect("/admin/appearance?geri=1")
}

/**
 * Enter the full-site preview: set a short-lived, random, server-verifiable
 * cookie scoped to the preview path. The draft read inside the preview route
 * re-checks the session + role + cookie on every request, so a revoked admin
 * loses preview access immediately.
 */
export async function enterPreviewAction(): Promise<void> {
  try {
    const { session } = await adminContext("manageTheme")
    const store = await cookies()
    const token = createAppearancePreviewToken({ userId: session.userId })
    store.set(PREVIEW_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/admin/appearance/preview",
      maxAge: 600, // 10 minutes — short on purpose
    })
  } catch (error) {
    toActionState(error, "enterPreview")
    return
  }
  redirect("/admin/appearance/preview")
}

/** Leave the preview: clear the cookie. Idempotent. */
export async function leavePreviewAction(): Promise<void> {
  try {
    const store = await cookies()
    store.delete({ name: PREVIEW_COOKIE, path: "/admin/appearance/preview" })
  } catch {
    // best-effort
  }
  // One explicit terminal navigation. Re-rendering the now cookie-less preview
  // and relying on its page guard to redirect added an unnecessary Flight
  // round trip and could recurse when the response was streamed.
  redirect("/admin/appearance")
}
