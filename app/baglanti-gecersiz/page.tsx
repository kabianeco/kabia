import type { Metadata } from "next"
import { AuthFlowPage } from "@/components/auth/auth-flow-page"
import { ButtonLink } from "@/components/ui/button"

export const metadata: Metadata = { title: "Bağlantı geçersiz", robots: { index: false } }

export default async function InvalidLinkPage({ searchParams }: { searchParams: Promise<{ flow?: string }> }) {
  const { flow } = await searchParams
  const isRecovery = flow === "recovery"
  const href = isRecovery ? "/sifremi-unuttum" : flow === "signup" ? "/eposta-onay-bekleniyor" : "/hesabim/bilgilerim"
  const label = isRecovery ? "Yeni bağlantı iste" : flow === "signup" ? "Doğrulama e-postasını yeniden gönder" : "Bilgilerime git"
  return <AuthFlowPage title="Bağlantı geçersiz" lead="Bu bağlantının süresi dolmuş, bağlantı kullanılmış veya adres eksik olabilir. Yeniden deneyebilirsiniz.">
    <ButtonLink href={href} size="lg">{label}</ButtonLink>
  </AuthFlowPage>
}
