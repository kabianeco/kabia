"use client"

import { useActionState } from "react"
import Link from "next/link"
import { customerResetPasswordAction } from "@/app/auth/actions"
import { ACTION_IDLE } from "@/lib/admin/errors"
import { Button } from "@/components/ui/button"
import { TextField } from "@/components/ui/field"

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(customerResetPasswordAction, ACTION_IDLE)
  return (
    <>
      <form action={action} className="space-y-7">
        <TextField label="E-posta" type="email" name="email" autoComplete="email" className="auth-field" required />
        <Button type="submit" size="lg" className="w-full" disabled={pending}>{pending ? "Gönderiliyor…" : "Bağlantı gönder"}</Button>
      </form>
      {state !== ACTION_IDLE && <p role="status" aria-live="polite" className="mt-7 text-sm text-ink/65">{state.message}</p>}
      <p className="mt-10 text-sm text-ink/60"><Link href="/giris" className="text-brand hover:text-forest">Girişe dön</Link></p>
    </>
  )
}
