"use client"

import { useActionState } from "react"
import { changeAdminPasswordAction } from "./actions"
import { ACTION_IDLE } from "@/lib/admin/errors"
import { AdminInput, FormMessage, SubmitButton } from "@/components/admin/ui/form"

export function AdminPasswordForm() {
  const [state, formAction] = useActionState(changeAdminPasswordAction, ACTION_IDLE)

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <AdminInput
        label="Yeni parola"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.password}
        hint="En az 12 karakter; büyük harf, küçük harf ve rakam içermeli."
      />

      <AdminInput
        label="Yeni parola (tekrar)"
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.confirm}
      />

      <FormMessage state={state} />

      <SubmitButton className="w-full" pendingLabel="Güncelleniyor…">
        Parolayı güncelle
      </SubmitButton>
    </form>
  )
}
