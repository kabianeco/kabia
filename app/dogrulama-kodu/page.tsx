import type { Metadata } from "next"
import { AuthFlowPage } from "@/components/auth/auth-flow-page"
import { VerificationCodeForm } from "@/components/auth/verification-code-form"

export const metadata: Metadata = { title: "Doğrulama kodu", robots: { index: false } }

export default function VerificationCodePage() {
  return <AuthFlowPage title="Kodla doğrulayın" lead="E-postanızdaki altı haneli kodu girin."><VerificationCodeForm /></AuthFlowPage>
}
