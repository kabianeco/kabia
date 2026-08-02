"use server"

import { revalidatePath, updateTag } from "next/cache"
import { adminContext } from "@/lib/admin/auth"
import { logAdminAction, AUDIT_WARNING } from "@/lib/admin/audit"
import { toActionState, type ActionState } from "@/lib/admin/errors"
import { settingKeySchema, settingValueSchemas } from "@/lib/admin/schemas"
import { SETTINGS_TAG } from "@/lib/settings"

/**
 * Settings updates, shared by the settings and content screens.
 *
 * The submitted value is validated against the *database's* declared type for
 * that key, not against a type the form claims. A form that posts
 * `store_open=banana` is rejected because `store_open` is recorded as a boolean
 * in `site_settings`, and the row's `value_type` is what the parser is chosen
 * from.
 *
 * The key set is fixed by migration: there is no INSERT or DELETE policy on the
 * table, so this can only ever change the value of a key that already exists.
 * Sensitive keys are additionally restricted to super_admin by RLS — the check
 * here produces the good error message, the policy is the boundary.
 *
 * A successful write invalidates the storefront's cached settings, which is
 * what makes the change visible on the public site without a redeployment.
 */
export async function updateSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { session, supabase } = await adminContext("manageSettings")

    const group = formData.get("group")
    if (typeof group !== "string" || group === "") {
      return { ok: false, message: "Geçersiz ayar grubu." }
    }

    const { data: rows, error: readError } = await supabase
      .from("site_settings")
      .select("key, value, value_type, label, is_sensitive")
      .eq("group_key", group)

    if (readError) return toActionState(readError, "updateSettings:read")
    if (!rows || rows.length === 0) return { ok: false, message: "Ayar bulunamadı." }

    const fieldErrors: Record<string, string> = {}
    const updates: { key: string; value: unknown; before: unknown; label: string }[] = []

    for (const row of rows as {
      key: string
      value: unknown
      value_type: "string" | "number" | "boolean"
      label: string
      is_sensitive: boolean
    }[]) {
      if (!settingKeySchema.safeParse(row.key).success) continue

      // A sensitive key that this administrator may not change is skipped
      // rather than rejected — the form never rendered it for them.
      if (row.is_sensitive && session.role !== "super_admin") continue

      const raw =
        row.value_type === "boolean"
          ? formData.get(row.key) === "on"
            ? "true"
            : "false"
          : formData.get(row.key)

      if (raw === null || raw === undefined) continue

      const parsed = settingValueSchemas[row.value_type].safeParse(raw)
      if (!parsed.success) {
        fieldErrors[row.key] = parsed.error.issues[0]?.message ?? "Geçersiz değer."
        continue
      }

      if (JSON.stringify(parsed.data) === JSON.stringify(row.value)) continue

      updates.push({ key: row.key, value: parsed.data, before: row.value, label: row.label })
    }

    if (Object.keys(fieldErrors).length > 0) {
      return { ok: false, fieldErrors, message: "Lütfen işaretli alanları düzeltin." }
    }

    if (updates.length === 0) {
      return { ok: true, message: "Değişiklik yok." }
    }

    for (const update of updates) {
      const { error } = await supabase
        .from("site_settings")
        .update({ value: update.value, updated_by: session.userId })
        .eq("key", update.key)
      if (error) return toActionState(error, `updateSettings:${update.key}`)
    }

    const audited = await logAdminAction(supabase, {
      action:
        group === "content" || group === "shop_banner"
          ? "content.update"
          : "settings.update",
      entityType: "setting",
      entityId: group,
      before: Object.fromEntries(updates.map((u) => [u.key, u.before])),
      after: Object.fromEntries(updates.map((u) => [u.key, u.value])),
      metadata: { group, changed_keys: updates.map((u) => u.key) },
    })

    // The storefront reads settings through a tagged cache; this is what makes
    // the change appear publicly without a deploy. `updateTag` rather than
    // `revalidateTag` because this is a Server Action and the operator must see
    // their own write on the very next render, not on a later revalidation.
    updateTag(SETTINGS_TAG)
    revalidatePath("/", "layout")
    revalidatePath("/admin/settings")
    revalidatePath("/admin/content")

    return {
      ok: true,
      message: `${updates.length} ayar güncellendi ve mağazaya yansıtıldı.`,
      warning: audited ? undefined : AUDIT_WARNING,
    }
  } catch (error) {
    return toActionState(error, "updateSettings")
  }
}
