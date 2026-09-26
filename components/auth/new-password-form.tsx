"use client"

import { useActionState, useState } from "react"
import { customerUpdatePasswordAction } from "@/app/auth/actions"
import { ACTION_IDLE } from "@/lib/admin/errors"
import { Button, ButtonLink } from "@/components/ui/button"
import { PasswordField } from "@/components/auth/password-field"
import { PASSWORD_MIN_LENGTH, PASSWORD_TOO_SHORT } from "@/lib/auth/password-policy"
import { routes } from "@/lib/site"

/** One password field with show/hide; success replaces the form in place. */
export function NewPasswordForm() {
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string>()
  const [state, action, pending] = useActionState(customerUpdatePasswordAction, ACTION_IDLE)

  if (state !== ACTION_IDLE && state.ok) {
    return (
      <div className="space-y-8">
        <p role="status" className="text-base leading-relaxed text-ink/65">
          Şifreniz güncellendi. Bundan sonra yeni şifrenizle giriş yapın.
        </p>
        <ButtonLink href={routes.account} size="lg" className="w-full">
          Hesabıma git <span aria-hidden="true">→</span>
        </ButtonLink>
      </div>
    )
  }

  const serverError = state !== ACTION_IDLE && !state.ok ? state.fieldErrors?.password ?? state.message : undefined

  return (
    <form
      action={action}
      noValidate
      onSubmit={(event) => {
        if (password.length < PASSWORD_MIN_LENGTH) {
          event.preventDefault()
          setError(PASSWORD_TOO_SHORT)
        } else {
          setError(undefined)
        }
      }}
      className="space-y-8"
    >
      <PasswordField
        label="Yeni şifre"
        name="password"
        value={password}
        onValueChange={setPassword}
        autoComplete="new-password"
        error={error ?? serverError}
        strength
        required
      />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Kaydediliyor…" : <>Şifreyi kaydet <span aria-hidden="true">→</span></>}
      </Button>
    </form>
  )
}
