"use client"

import { useActionState } from "react"
import { updateSettingsAction } from "./actions"
import { ACTION_IDLE } from "@/lib/admin/errors"
import {
  AdminCheckbox,
  AdminInput,
  AdminTextarea,
  FormMessage,
  SubmitButton,
} from "@/components/admin/ui/form"
import { Panel } from "@/components/admin/ui/surfaces"

export interface SettingRow {
  key: string
  value: unknown
  valueType: "string" | "number" | "boolean"
  label: string
  groupKey: string
  isSensitive: boolean
}

/**
 * One form per settings group.
 *
 * Controls are generated from the rows the database actually returned, so a key
 * that does not exist cannot be rendered, and a key the current administrator
 * may not change is simply not present in the form. `readOnly` renders the
 * value with an explanation instead of an input, so a plain admin can see the
 * store's state without being able to alter it.
 */
export function SettingsGroupForm({
  group,
  title,
  description,
  settings,
  canEditSensitive,
  longFields = [],
}: {
  group: string
  title: string
  description?: string
  settings: SettingRow[]
  canEditSensitive: boolean
  /** Keys that deserve a textarea rather than a single-line input. */
  longFields?: string[]
}) {
  const [state, formAction] = useActionState(updateSettingsAction, ACTION_IDLE)
  const errors = state.fieldErrors ?? {}

  if (settings.length === 0) return null

  const editable = settings.filter((s) => !s.isSensitive || canEditSensitive)
  const readOnly = settings.filter((s) => s.isSensitive && !canEditSensitive)

  return (
    <Panel title={title} description={description}>
      <form action={formAction} className="space-y-5" noValidate>
        <input type="hidden" name="group" value={group} />

        <div className="grid gap-5 sm:grid-cols-2">
          {editable.map((setting) => {
            const isLong = longFields.includes(setting.key)
            const wrapper = isLong ? "sm:col-span-2" : undefined

            if (setting.valueType === "boolean") {
              return (
                <AdminCheckbox
                  key={setting.key}
                  name={setting.key}
                  label={setting.label}
                  defaultChecked={setting.value === true}
                  className={wrapper}
                  hint={setting.isSensitive ? "Hassas ayar — yalnızca süper yönetici." : undefined}
                />
              )
            }

            if (isLong) {
              return (
                <AdminTextarea
                  key={setting.key}
                  name={setting.key}
                  label={setting.label}
                  rows={3}
                  defaultValue={String(setting.value ?? "")}
                  error={errors[setting.key]}
                  wrapperClassName={wrapper}
                />
              )
            }

            return (
              <AdminInput
                key={setting.key}
                name={setting.key}
                label={setting.label}
                inputMode={setting.valueType === "number" ? "decimal" : undefined}
                defaultValue={String(setting.value ?? "")}
                error={errors[setting.key]}
                hint={setting.isSensitive ? "Hassas ayar — yalnızca süper yönetici." : undefined}
              />
            )
          })}
        </div>

        {readOnly.length > 0 && (
          <dl className="grid gap-4 rounded-[3px] border border-ink/10 bg-ivory/60 p-4 sm:grid-cols-2">
            {readOnly.map((setting) => (
              <div key={setting.key}>
                <dt className="label text-olive">{setting.label}</dt>
                <dd className="mt-1 text-sm text-ink/70">
                  {setting.valueType === "boolean"
                    ? setting.value === true
                      ? "Açık"
                      : "Kapalı"
                    : String(setting.value ?? "—") || "—"}
                </dd>
              </div>
            ))}
            <p className="text-xs leading-relaxed text-ink/45 sm:col-span-2">
              Bu ayarlar hassas olarak işaretlenmiştir ve yalnızca süper yöneticiler
              tarafından değiştirilebilir.
            </p>
          </dl>
        )}

        <FormMessage state={state} />

        <SubmitButton pendingLabel="Kaydediliyor…">Kaydet</SubmitButton>
      </form>
    </Panel>
  )
}
