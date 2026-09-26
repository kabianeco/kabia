import type { ReactNode } from "react"
import { AuthShell } from "@/components/auth/auth-shell"
import { PageShell } from "@/components/layout/page-shell"
import { ArrowLink, ButtonLink } from "@/components/ui/button"

export type StatusTone = "success" | "waiting" | "error"

/**
 * One frame for every success, waiting and error moment in the auth flows:
 * a short heading, one line, one primary action, and at most one quiet
 * secondary link. The tone is carried by the small eyebrow alone — no icon,
 * box or border — so the three states differ without adding weight.
 */
export function StatusScreen({
  tone,
  eyebrow,
  title,
  lead,
  action,
  secondary,
  children,
}: {
  tone: StatusTone
  eyebrow: string
  title: ReactNode
  lead: ReactNode
  action?: { href: string; label: string }
  secondary?: { href: string; label: string }
  children?: ReactNode
}) {
  return (
    <PageShell>
      <AuthShell
        eyebrow={eyebrow}
        eyebrowTone={tone === "error" ? "text-clay" : tone === "success" ? "text-brand" : "text-olive"}
        title={title}
        lead={lead}
        image="/images/orchard-hillside.jpg"
        imageCaption="Sabırlar köyünün yamaçlarında, dört mevsim aynı bahçe."
      >
        {children}
        {action && (
          <ButtonLink href={action.href} size="lg" className="w-full">
            {action.label} <span aria-hidden="true">→</span>
          </ButtonLink>
        )}
        {secondary && (
          <p className="mt-8">
            <ArrowLink href={secondary.href}>{secondary.label}</ArrowLink>
          </p>
        )}
      </AuthShell>
    </PageShell>
  )
}
