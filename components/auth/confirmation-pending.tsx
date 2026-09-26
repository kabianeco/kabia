"use client"

import { useActionState, useEffect, useState } from "react"
import Link from "next/link"
import { customerResendConfirmationAction } from "@/app/auth/actions"
import { ACTION_IDLE } from "@/lib/admin/errors"
import { Button } from "@/components/ui/button"
import { TextField } from "@/components/ui/field"

export const PENDING_EMAIL_KEY = "kabia_pending_email"
const COOLDOWN_KEY = "kabia_resend_until"

export function ConfirmationPending() {
  const [email, setEmail] = useState("")
  const [seconds, setSeconds] = useState(0)
  const [state, action, pending] = useActionState(customerResendConfirmationAction, ACTION_IDLE)

  useEffect(() => {
    const initial = setTimeout(() => setEmail(sessionStorage.getItem(PENDING_EMAIL_KEY) ?? ""), 0)
    const tick = () => setSeconds(Math.max(0, Math.ceil((Number(sessionStorage.getItem(COOLDOWN_KEY)) - Date.now()) / 1000) || 0))
    const firstTick = setTimeout(tick, 0)
    const interval = setInterval(tick, 1000)
    return () => { clearTimeout(initial); clearTimeout(firstTick); clearInterval(interval) }
  }, [])

  useEffect(() => {
    if (state !== ACTION_IDLE && state.ok) {
      sessionStorage.setItem(COOLDOWN_KEY, String(Date.now() + 60_000))
      const update = setTimeout(() => setSeconds(60), 0)
      return () => clearTimeout(update)
    }
  }, [state])

  return (
    <div className="space-y-7">
      <p className="text-sm leading-relaxed text-ink/65">E-posta gelmediyse gereksiz klasörünü de kontrol edin. Bu adres için bir hesap varsa doğrulama e-postasını yeniden gönderebiliriz.</p>
      <form action={action} className="space-y-7">
        <TextField label="E-posta" type="email" name="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" className="auth-field" required />
        <Button type="submit" size="lg" disabled={pending || seconds > 0} className="w-full">{pending ? "Gönderiliyor…" : "Tekrar gönder"}</Button>
      </form>
      <p role="status" aria-live="polite" className="text-sm text-ink/65">
        {seconds > 0 ? `${seconds} saniye sonra tekrar gönderebilirsiniz.` : state !== ACTION_IDLE ? state.message : ""}
      </p>
      <Link href="/dogrulama-kodu" className="text-sm text-brand transition-colors hover:text-forest">Kodla doğrula</Link>
    </div>
  )
}
