"use client"

import { useCallback, useState } from "react"
import { AuthShell } from "@/components/auth/auth-shell"
import { Accent } from "@/components/auth/accent"
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"

/** The request step and its sent state share one screen; only the words change. */
export function ForgotPasswordFlow({ sessionExpired }: { sessionExpired: boolean }) {
  const [sent, setSent] = useState(false)
  const onSent = useCallback(() => setSent(true), [])
  return (
    <AuthShell
      eyebrow="Hesap"
      title={sent ? <>E-postanızı <Accent>kontrol edin</Accent>.</> : <>Şifrenizi <Accent>sıfırlayın</Accent>.</>}
      lead={
        sent
          ? undefined
          : sessionExpired
            ? "Şifre yenileme bağlantınızın süresi dolmuş. Adresinizi girin, yenisini gönderelim."
            : "Adresinizi girin, şifre yenileme bağlantısı gönderelim."
      }
      image="/images/orchard-hillside.jpg"
      imageCaption="Sabırlar köyünün yamaçlarında, dört mevsim aynı bahçe."
    >
      <ForgotPasswordForm onSent={onSent} />
    </AuthShell>
  )
}
