"use client"

import { useActionState } from "react"
import { adminLoginAction } from "./actions"
import { ACTION_IDLE } from "@/lib/admin/errors"
import { AdminInput, FormMessage, SubmitButton } from "@/components/admin/ui/form"

export function AdminLoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState(adminLoginAction, ACTION_IDLE)

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {next && <input type="hidden" name="next" value={next} />}

      <AdminInput
        label="Kullanıcı adı"
        name="identifier"
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        required
        hint="Kullanıcı adınızı ya da e-posta adresinizi girebilirsiniz."
      />

      <AdminInput
        label="Şifre"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />

      <FormMessage state={state} />

      <SubmitButton className="w-full" pendingLabel="Giriş yapılıyor…">
        Giriş yap
      </SubmitButton>
    </form>
  )
}
