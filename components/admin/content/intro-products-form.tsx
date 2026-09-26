"use client"

import { useActionState } from "react"
import { updateSettingsAction } from "@/app/admin/(protected)/settings/actions"
import { ACTION_IDLE } from "@/lib/admin/errors"
import { AdminSelect, FormMessage, SubmitButton } from "@/components/admin/ui/form"
import { Panel } from "@/components/admin/ui/surfaces"

export interface IntroProductOption {
  slug: string
  name: string
  isActive: boolean
}

const LINES = [
  { key: "intro_product_ciftlik", label: "Çiftlik giriş ürünü", sourceName: "Kabia Çiftliği" },
  { key: "intro_product_secki", label: "Seçki giriş ürünü", sourceName: "Kabia Seçki" },
  { key: "intro_product_mutfak", label: "Mutfak giriş ürünü", sourceName: "Kabia Mutfak" },
] as const

/**
 * §8.2: chooses each source's homepage intro product. Posts to the shared
 * settings action (group=content) so validation, audit and cache
 * invalidation stay in one place; only active products are offered, and the
 * current value is pre-selected. The homepage falls back to its curated
 * entries when a chosen slug is missing or inactive, so a bad save can never
 * blank the section.
 */
export function IntroProductsForm({
  current,
  products,
}: {
  current: Record<string, string>
  products: IntroProductOption[]
}) {
  const [state, formAction] = useActionState(updateSettingsAction, ACTION_IDLE)
  const errors = state.fieldErrors ?? {}
  const active = products.filter((p) => p.isActive)

  return (
    <Panel
      title="Giriş ürünleri (3 sabit)"
      description="Anasayfadaki üç dünyadan-birer-tat bölümünün her satırda göstereceği ürün. Yalnızca aktif ürünler seçilebilir."
    >
      <form action={formAction} className="space-y-5" noValidate>
        <input type="hidden" name="group" value="content" />
        {LINES.map((line) => (
          <AdminSelect
            key={line.key}
            label={`${line.label} — ${line.sourceName}`}
            name={line.key}
            defaultValue={current[line.key] ?? ""}
            error={errors[line.key]}
            required
          >
            <option value="" disabled>
              Seçiniz
            </option>
            {active.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name} ({p.slug})
              </option>
            ))}
          </AdminSelect>
        ))}
        <FormMessage state={state} />
        <SubmitButton>Seçimi kaydet</SubmitButton>
      </form>
    </Panel>
  )
}
