import type { Metadata } from "next"
import { PageShell } from "@/components/layout/page-shell"
import { ForgotPasswordFlow } from "@/components/auth/forgot-password-flow"

export const metadata: Metadata = { title: "Şifremi unuttum", robots: { index: false } }

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams
  return (
    <PageShell>
      <ForgotPasswordFlow sessionExpired={reason === "session"} />
    </PageShell>
  )
}
