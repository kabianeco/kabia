import type { Metadata } from "next"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { Accent } from "@/components/auth/accent"
import { StatusScreen } from "@/components/auth/status-screen"
import { FLOW_COOKIES, verifyFlowMarker } from "@/lib/auth/flow-marker"
import { ORDER_RECORD_RETENTION_YEARS } from "@/lib/account/retention"
import { routes } from "@/lib/site"

export const metadata: Metadata = { title: "Hesap silindi", robots: { index: false } }

/** Only right after a deletion (short-lived marker set by the delete action). */
export default async function AccountDeletedPage() {
  const cookieStore = await cookies()
  if (!verifyFlowMarker(cookieStore.get(FLOW_COOKIES.account_deleted.name)?.value, "account_deleted", "done")) {
    redirect(routes.home)
  }
  return (
    <StatusScreen
      tone="success"
      eyebrow="Hesap · Silindi"
      title={<>Hesabınız <Accent>silindi</Accent>.</>}
      lead={`Kişisel verileriniz silindi. Sipariş kayıtları yasal zorunluluk nedeniyle ${ORDER_RECORD_RETENTION_YEARS} yıl saklanır.`}
      action={{ href: routes.home, label: "Ana sayfaya dön" }}
    />
  )
}
