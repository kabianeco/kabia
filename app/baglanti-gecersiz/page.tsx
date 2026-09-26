import type { Metadata } from "next"
import { Accent } from "@/components/auth/accent"
import { StatusScreen } from "@/components/auth/status-screen"
import { routes } from "@/lib/site"

export const metadata: Metadata = { title: "Bağlantı geçersiz", robots: { index: false } }

/** Never claims why a link failed; offers the one next step for that flow. */
const FLOWS = {
  signup: { lead: "Kodla doğrulayabilir ya da yeni bir kod isteyebilirsiniz.", action: { href: routes.verificationCode, label: "Kodla doğrula" } },
  recovery: { lead: "Yeni bir şifre yenileme bağlantısı isteyin.", action: { href: routes.forgotPassword, label: "Yeni bağlantı iste" } },
  change: { lead: "E-posta değişikliğini güvenlik ayarlarından yeniden başlatabilirsiniz.", action: { href: routes.accountSecurity, label: "Güvenlik ayarlarına git" } },
} as const

export default async function InvalidLinkPage({ searchParams }: { searchParams: Promise<{ flow?: string }> }) {
  const { flow } = await searchParams
  const content = flow === "signup" || flow === "recovery" ? FLOWS[flow] : FLOWS.change
  return (
    <StatusScreen
      tone="error"
      eyebrow="Hesap · Bağlantı geçersiz"
      title={<>Bu bağlantı <Accent>kullanılamıyor</Accent>.</>}
      lead={`Süresi dolmuş ya da daha önce kullanılmış olabilir. ${content.lead}`}
      action={content.action}
    />
  )
}
