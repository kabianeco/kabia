import type { ReactNode } from "react"
import { PageShell } from "@/components/layout/page-shell"
import { AuthShell } from "@/components/auth/auth-shell"

/** A form step in the auth flows: short heading, one line, then the form. */
export function AuthFlowPage({ title, lead, children }: { title: ReactNode; lead?: ReactNode; children: ReactNode }) {
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

export { Accent } from "@/components/auth/accent"
