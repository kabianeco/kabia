import type { Metadata } from "next"
import { Accent, AuthFlowPage } from "@/components/auth/auth-flow-page"
import { CodeLead } from "@/components/auth/pending-address"
import { VerificationCodeForm } from "@/components/auth/verification-code-form"

export const metadata: Metadata = { title: "Doğrulama kodu", robots: { index: false } }

export default function VerificationCodePage() {
  return (
    <AuthFlowPage title={<>Kodu <Accent>girin</Accent>.</>} lead={<CodeLead />}>
      <VerificationCodeForm />
    </AuthFlowPage>
  )
}
