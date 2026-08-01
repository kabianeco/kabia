import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logQueryError } from "@/lib/admin/errors"
import type { SettingRow } from "@/app/admin/(protected)/settings/settings-form"

/**
 * Settings read for the admin screens.
 *
 * Read through the administrator's own session, so RLS returns the public rows
 * plus — for an administrator — everything else. The `is_sensitive` flag comes
 * back with each row so the form knows which controls to render read-only.
 */
export async function loadSettingsByGroup(
  supabase: SupabaseClient,
): Promise<Record<string, SettingRow[]>> {
  const { data, error } = await supabase
    .from("site_settings")
    .select("key, value, value_type, label, group_key, is_sensitive")
    .order("group_key")
    .order("key")

  if (error) {
    logQueryError("settings:load", error)
    return {}
  }

  const grouped: Record<string, SettingRow[]> = {}
  for (const row of (data ?? []) as {
    key: string
    value: unknown
    value_type: "string" | "number" | "boolean"
    label: string
    group_key: string
    is_sensitive: boolean
  }[]) {
    const entry: SettingRow = {
      key: row.key,
      value: row.value,
      valueType: row.value_type,
      label: row.label,
      groupKey: row.group_key,
      isSensitive: row.is_sensitive,
    }
    ;(grouped[row.group_key] ??= []).push(entry)
  }
  return grouped
}
