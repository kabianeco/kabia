"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { customerResendConfirmationAction, customerVerifyCodeAction } from "@/app/auth/actions"
import { ACTION_IDLE, type ActionState } from "@/lib/admin/errors"
import { Button } from "@/components/ui/button"
import { TextField } from "@/components/ui/field"
import { CodeInput } from "@/components/auth/code-input"
import { ResendLine } from "@/components/auth/resend-line"
import { usePendingEmail } from "@/components/auth/pending-address"
import { CODE_LENGTH, emptyDigits, isValidCode, joinDigits } from "@/lib/auth/code"
import { clearPendingEmail } from "@/lib/auth/pending"

/**
 * The code screen's form: the digit boxes, one confirm button and the quiet
 * resend line. The address field appears only when this tab does not already
 * know where the code went (for example, the e-mail was opened elsewhere).
 */
export function VerificationCodeForm() {
  const router = useRouter()
  const { email: pendingEmail, ready } = usePendingEmail()
  const [typedEmail, setTypedEmail] = useState("")
  const [digits, setDigits] = useState<string[]>(emptyDigits)
  const [localError, setLocalError] = useState("")
  const [state, action, pending] = useActionState(customerVerifyCodeAction, ACTION_IDLE)
  const group = useRef<HTMLDivElement>(null)

  const email = pendingEmail || typedEmail
  const result = state as ActionState & { redirectTo?: string }
  const serverError = result !== ACTION_IDLE && !result.ok ? result.message : ""
  const error = localError || serverError

  useEffect(() => {
    if (result.ok && result.redirectTo) {
      clearPendingEmail()
      router.replace(result.redirectTo)
    }
  }, [result, router])

  useEffect(() => {
    // After a failed attempt, return focus to the first box so the code can
    // be retyped straight away; the message is announced by role="alert".
    if (serverError) group.current?.querySelector<HTMLInputElement>("input")?.focus()
  }, [serverError, state])

  return (
    <div className="space-y-8">
      <form
        action={action}
        noValidate
        onSubmit={(event) => {
          if (!isValidCode(joinDigits(digits))) {
            event.preventDefault()
            setLocalError(`Kodun ${CODE_LENGTH} hanesini de girin.`)
            group.current?.querySelector<HTMLInputElement>("input")?.focus()
          } else {
            setLocalError("")
          }
        }}
        className="space-y-8"
      >
        {ready && !pendingEmail ? (
          <TextField
            label="E-posta"
            type="email"
            value={typedEmail}
            onChange={(event) => setTypedEmail(event.target.value)}
            autoComplete="email"
            className="auth-field"
            required
          />
        ) : null}
        <input type="hidden" name="email" value={email} />
        <div ref={group}>
          <CodeInput
            name="token"
            label="Doğrulama kodu"
            digits={digits}
            onDigitsChange={(next) => {
              setDigits(next)
              if (localError) setLocalError("")
            }}
            error={error}
            disabled={pending}
            autoFocus
          />
        </div>
        <p role="alert" className="sr-only">
          {error}
        </p>
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Doğrulanıyor…" : <>Doğrula <span aria-hidden="true">→</span></>}
        </Button>
      </form>
      <ResendLine
        kind="signup"
        email={email}
        action={customerResendConfirmationAction}
        prompt="Kod gelmedi mi?"
        sentText="Yeni kod gönderildi."
      />
    </div>
  )
}
