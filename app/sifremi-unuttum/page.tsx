import type { Metadata } from "next"
import { AuthFlowPage } from "@/components/auth/auth-flow-page"
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"

export const metadata: Metadata = { title: "Şifremi unuttum", robots: { index: false } }

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams
  return <AuthFlowPage title="Şifrenizi sıfırlayın" lead="E-posta adresinizi girin. Bu adres için bir hesap varsa şifre yenileme bağlantısı göndereceğiz.">
    {reason === "session" && <p role="alert" className="mb-7 text-sm text-clay">Şifre yenileme oturumunuz geçerli değil. Yeni bir bağlantı isteyin.</p>}
    <ForgotPasswordForm />
  </AuthFlowPage>
}
