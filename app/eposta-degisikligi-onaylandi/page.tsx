import type { Metadata } from "next"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { Accent } from "@/components/auth/accent"
import { StatusScreen } from "@/components/auth/status-screen"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { FLOW_COOKIES, verifyFlowMarker } from "@/lib/auth/flow-marker"
import { routes } from "@/lib/site"

export const metadata: Metadata = { title: "E-posta değişikliği", robots: { index: false } }

/**
 * Reached only through /auth/confirm right after an e-mail change link was
 * verified (short-lived marker cookie). Supabase may still be waiting for the
 * link sent to the other address; the page says which.
 */
export default async function EmailChangeConfirmedPage() {
  const cookieStore = await cookies()
  if (!verifyFlowMarker(cookieStore.get(FLOW_COOKIES.email_change.name)?.value, "email_change", "link")) {
    redirect(routes.accountSecurity)
  }
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user?.new_email) {
    return (
      <StatusScreen
        tone="waiting"
        eyebrow="Hesap · E-posta değişikliği"
        title={<>Bir onay <Accent>daha</Accent>.</>}
        lead="Bu bağlantı onaylandı. Değişikliğin tamamlanması için diğer adresinize gelen bağlantıyı da açın."
        action={{ href: routes.accountSecurity, label: "Güvenlik ayarlarına dön" }}
      />
    )
  }
  if (user) {
    return (
      <StatusScreen
        tone="success"
        eyebrow="Hesap · E-posta değişikliği"
        title={<>Adresiniz <Accent>güncellendi</Accent>.</>}
        lead={<>Bundan sonra <span className="break-all text-ink">{user.email}</span> ile giriş yapın.</>}
        action={{ href: routes.accountSecurity, label: "Güvenlik ayarlarına dön" }}
      />
    )
  }
  return (
    <StatusScreen
      tone="waiting"
      eyebrow="Hesap · E-posta değişikliği"
      title={<>Bağlantı <Accent>onaylandı</Accent>.</>}
      lead="Değişikliğin son durumunu görmek için giriş yapın."
      action={{ href: `${routes.login}?next=${encodeURIComponent(routes.accountSecurity)}`, label: "Giriş yap" }}
    />
  )
}
