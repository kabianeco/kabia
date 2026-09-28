import type { Metadata } from "next"
import { PageShell } from "@/components/layout/page-shell"
import { GuideHeader, GuideLink, GuideNotes } from "@/components/guides/guide-parts"
import { guides, guidesHub } from "@/content/guides"
import { routes } from "@/lib/site"
import { pageMetadata } from "@/lib/seo"

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: guidesHub.metaTitle,
    description: guidesHub.description,
    path: routes.guides,
  })
}

/** The guide hub: one note per guide, linked. Product pages link here. */
export default function GuidesPage() {
  return (
    <PageShell>
      <section aria-labelledby="guide-heading">
        <GuideHeader
          crumbs={[
            { label: "Ana sayfa", href: routes.home },
            { label: "Rehber", href: routes.guides },
          ]}
          eyebrow={guidesHub.eyebrow}
          heading={guidesHub.heading}
          intro={guidesHub.intro}
        />
        <div className="wrap">
          <GuideNotes
            notes={guides.map((guide) => ({
              title: `${guide.heading.join("")}`,
              body: (
                <>
                  <p>{guide.description}</p>
                  <p className="mt-2">
                    <GuideLink href={routes.guide(guide.slug)}>Rehberi oku</GuideLink>
                  </p>
                </>
              ),
            }))}
          />
        </div>
      </section>
    </PageShell>
  )
}
