"use client"

import { useActionState, useEffect, useState } from "react"
import Link from "next/link"
import { customerResetPasswordAction } from "@/app/auth/actions"
import { ACTION_IDLE } from "@/lib/admin/errors"
import { Button } from "@/components/ui/button"
import { TextField } from "@/components/ui/field"
import { ResendLine } from "@/components/auth/resend-line"
import { startResendCooldown } from "@/lib/auth/pending"
import { routes } from "@/lib/site"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Request form, then — in place — the sent state: where the link went (in
 * words that never confirm an account exists), the way back, and the quiet
 * resend line. The heading above changes with it (see ForgotPasswordFlow).
 */
export function ForgotPasswordForm({ onSent }: { onSent?: () => void }) {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string>()
  const [state, action, pending] = useActionState(customerResetPasswordAction, ACTION_IDLE)
  const [submitted, setSubmitted] = useState("")
  const sent = state !== ACTION_IDLE && state.ok

  useEffect(() => {
    if (!sent) return
    startResendCooldown("recovery")
    onSent?.()
  }, [sent, onSent])

  if (sent) {
    return (
      <div className="space-y-8">
        <p role="status" className="text-base leading-relaxed text-ink/65">
          Bu adres için bir hesap varsa şifre yenileme bağlantısını <span className="break-all text-ink">{submitted}</span> adresine gönderdik.
        </p>
        <Link href={routes.login} className="inline-flex min-h-11 items-center text-sm text-brand transition-colors duration-300 hover:text-forest">
          Girişe dön
        </Link>
        <ResendLine
          kind="recovery"
          email={submitted}
          action={customerResetPasswordAction}
          prompt="E-posta gelmedi mi?"
          sentText="Bağlantı yeniden gönderildi."
        />
      </div>
    )
  }

  const serverError = state !== ACTION_IDLE && !state.ok ? state.message : undefined

  return (
    <>
      <form
        action={action}
        noValidate
        onSubmit={(event) => {
          if (!EMAIL_RE.test(email.trim())) {
            event.preventDefault()
            setError("Geçerli bir e-posta adresi girin.")
          } else {
            setError(undefined)
            setSubmitted(email.trim())
          }
        }}
        className="space-y-7"
      >
        <TextField
          label="E-posta"
          type="email"
          name="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          error={error ?? serverError}
          className="auth-field"
          required
        />
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Gönderiliyor…" : <>Bağlantı gönder <span aria-hidden="true">→</span></>}
        </Button>
      </form>
      <p className="mt-10 border-t border-ink/10 pt-8 text-sm text-ink/60">
        <Link href={routes.login} className="text-brand transition-colors duration-300 hover:text-forest">
          Girişe dön
        </Link>
      </p>
    </>
  )
}
