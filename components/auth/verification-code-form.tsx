"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { customerVerifyCodeAction } from "@/app/auth/actions"
import { ACTION_IDLE } from "@/lib/admin/errors"
import type { ActionState } from "@/lib/admin/errors"
import { Button } from "@/components/ui/button"
import { TextField } from "@/components/ui/field"
import { PENDING_EMAIL_KEY } from "@/components/auth/confirmation-pending"

export function VerificationCodeForm() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [state, action, pending] = useActionState(customerVerifyCodeAction, ACTION_IDLE)

  useEffect(() => {
    const timer = setTimeout(() => setEmail(sessionStorage.getItem(PENDING_EMAIL_KEY) ?? ""), 0)
    return () => clearTimeout(timer)
  }, [])
  useEffect(() => {
    const result = state as ActionState & { redirectTo?: string }
    if (result.ok && result.redirectTo) {
      sessionStorage.removeItem(PENDING_EMAIL_KEY)
      router.replace(result.redirectTo)
    }
  }, [state, router])

  return (
    <>
      <form action={action} className="space-y-7">
        <TextField label="E-posta" type="email" name="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" className="auth-field" required />
        <TextField label="Altı haneli kod" name="token" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" className="auth-field" required />
        {state !== ACTION_IDLE && !state.ok && <p role="alert" className="text-sm text-clay">{state.message}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={pending}>{pending ? "Doğrulanıyor…" : "Kodu doğrula"}</Button>
      </form>
      <p className="mt-10 text-sm text-ink/60">Yeni kod mu gerekiyor? <Link href="/eposta-onay-bekleniyor" className="text-brand hover:text-forest">Tekrar gönder</Link></p>
    </>
  )
}
