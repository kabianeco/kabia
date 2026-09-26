import type { Metadata } from "next"
import { AuthFlowPage } from "@/components/auth/auth-flow-page"
import { ConfirmationPending } from "@/components/auth/confirmation-pending"

export const metadata: Metadata = { title: "E-posta onayı bekleniyor", robots: { index: false } }

export default function ConfirmationPendingPage() {
  return <AuthFlowPage title="E-postanızı kontrol edin" lead="Bu adres için doğrulama gerekiyorsa, bağlantı ve altı haneli kod e-postanıza gönderildi."><ConfirmationPending /></AuthFlowPage>
}
