"use client"

import { useActionState } from "react"
import { customerUpdatePasswordAction } from "@/app/auth/actions"
import { ACTION_IDLE } from "@/lib/admin/errors"
import type { ActionState } from "@/lib/admin/errors"
import { Button } from "@/components/ui/button"
import { TextField } from "@/components/ui/field"
import { TimedRedirect } from "@/components/auth/timed-redirect"

export function NewPasswordForm() {
  const [state, action, pending] = useActionState(customerUpdatePasswordAction, ACTION_IDLE)
  const result = state as ActionState & { redirectTo?: string }
  if (result.ok && result.redirectTo) {
    return <div className="space-y-7"><p role="status" className="text-sm text-ink/65">Şifreniz güncellendi.</p><TimedRedirect href={result.redirectTo} label="Hesabıma git" /></div>
  }
  return (
    <form action={action} className="space-y-7">
      <TextField label="Yeni şifre" type="password" name="password" hint="En az 6 karakter" minLength={6} maxLength={200} autoComplete="new-password" className="auth-field" required />
      <TextField label="Yeni şifre tekrar" type="password" name="passwordRepeat" minLength={6} maxLength={200} autoComplete="new-password" className="auth-field" required />
      {state !== ACTION_IDLE && !state.ok && <p role="alert" className="text-sm text-clay">{state.message}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>{pending ? "Güncelleniyor…" : "Şifreyi güncelle"}</Button>
    </form>
  )
}
