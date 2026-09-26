import type { ReactNode } from "react"
import { PageShell } from "@/components/layout/page-shell"
import { AuthShell } from "@/components/auth/auth-shell"

export function AuthFlowPage({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  return (
    <PageShell>
      <AuthShell
        eyebrow="Hesap"
        title={title}
        lead={lead}
        image="/images/orchard-hillside.jpg"
        imageCaption="Sabırlar köyünün yamaçlarında, dört mevsim aynı bahçe."
      >
        {children}
      </AuthShell>
    </PageShell>
  )
}
