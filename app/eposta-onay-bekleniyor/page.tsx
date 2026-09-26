import type { Metadata } from "next"
import { Accent, AuthFlowPage } from "@/components/auth/auth-flow-page"
import { WaitingLead } from "@/components/auth/pending-address"
import { ButtonLink } from "@/components/ui/button"
import { routes } from "@/lib/site"

export const metadata: Metadata = { title: "E-posta onayı bekleniyor", robots: { index: false } }

/** Heading, where the e-mail went, and the way to enter the code. Nothing else. */
export default function ConfirmationPendingPage() {
  return (
    <AuthFlowPage title={<>E-postanızı <Accent>kontrol edin</Accent>.</>} lead={<WaitingLead />}>
      <ButtonLink href={routes.verificationCode} size="lg" className="w-full">
        Kodu gir <span aria-hidden="true">→</span>
      </ButtonLink>
    </AuthFlowPage>
  )
}
