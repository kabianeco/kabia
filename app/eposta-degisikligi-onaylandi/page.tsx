import type { Metadata } from "next"
import { AuthFlowPage } from "@/components/auth/auth-flow-page"
import { ButtonLink } from "@/components/ui/button"

export const metadata: Metadata = { title: "E-posta değişikliği onaylandı", robots: { index: false } }

export default function EmailChangeConfirmedPage() {
  return <AuthFlowPage title="E-posta bağlantısı doğrulandı" lead="Adres değişikliği için diğer e-postanıza gelen onay da gerekebilir. Hesap bilgilerinizden son durumu kontrol edin."><ButtonLink href="/hesabim/bilgilerim" size="lg">Bilgilerime git</ButtonLink></AuthFlowPage>
}
