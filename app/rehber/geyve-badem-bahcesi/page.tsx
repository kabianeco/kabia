import type { Metadata } from "next"
import { PageShell } from "@/components/layout/page-shell"
import {
  GuideClosing,
  GuideFacts,
  GuideHeader,
  GuideLink,
  GuideNotes,
  GuideSection,
  GuideSteps,
} from "@/components/guides/guide-parts"
import { guideBySlug, orchardGuideCopy as copy } from "@/content/guides"
import { farmCertificate, farmPrinciples, farmTimeline } from "@/content/farm"
import { farm, soil } from "@/content/pages"
import { getCachedPublishedJournal } from "@/lib/journal"
import { routes } from "@/lib/site"
import { articleJsonLd, pageMetadata } from "@/lib/seo"

const guide = guideBySlug("geyve-badem-bahcesi")!

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: guide.metaTitle,
    description: guide.description,
    path: routes.guide(guide.slug),
    type: "article",
    keywords: guide.keywords,
  })
}

function formatEntryDate(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })
}

/**
 * The orchard, as a guide: where it is, how big, how it began (2019) and was
 * planted (2021), the year-by-year timeline, the soil principles, the harvest
 * sign with the latest field notes, and the certificate. Every fact is read
 * from content/pages.ts, content/farm.ts, content/homepage.ts (via
 * content/guides.ts) and the journal (the database); the certificate only from
 * content/farm.ts, so a renewal changes it here too.
 *
 * If the journal cannot be read, the latest-notes list is left out rather than
 * failing the whole guide: everything else on the page is static.
 */
export default async function OrchardGuidePage() {
  const journalResult = await getCachedPublishedJournal()
  const latestNotes =
    journalResult.status === "ok"
      ? [...journalResult.entries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3)
      : []
  return (
    <PageShell>
      <article aria-labelledby="guide-heading">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              articleJsonLd({
                headline: guide.heading.join(""),
                description: guide.description,
                path: routes.guide(guide.slug),
                datePublished: guide.datePublished,
                image: farmTimeline[1]?.image,
              }),
            ),
          }}
        />
        <GuideHeader
          crumbs={[
            { label: "Ana sayfa", href: routes.home },
            { label: "Rehber", href: routes.guides },
            { label: "Geyve'de bir badem bahçesi", href: routes.guide(guide.slug) },
          ]}
          eyebrow={guide.eyebrow}
          heading={guide.heading}
          intro={farm.intro[1]}
        />

        <div className="wrap">
          <GuideNotes notes={copy.facts} />

          <GuideSection heading={copy.timelineHeading} />
          <GuideSteps
            steps={[
              {
                key: "2019",
                marker: "2019",
                title: copy.start.heading,
                body: (
                  <>
                    <p className="label text-olive">{copy.start.eyebrow}</p>
                    <p className="mt-2">{copy.start.body}</p>
                  </>
                ),
              },
              ...farmTimeline.map((state) => ({
                key: state.id,
                marker: state.year,
                title: state.heading,
                body: (
                  <>
                    <p className="label text-olive">{state.eyebrow}</p>
                    <p className="mt-2">{state.paragraphs[0]}</p>
                  </>
                ),
              })),
            ]}
          />
          <p className="pb-16 md:pb-20">
            <GuideLink href={routes.farm}>Bahçenin hikâyesinin tamamı: Çiftlik</GuideLink>
          </p>

          <GuideSection heading={copy.soilHeading}>
            <ul className="space-y-3">
              {farmPrinciples.map((principle) => (
                <li key={principle}>{principle}</li>
              ))}
            </ul>
            <p className="mt-6">{soil.closing}</p>
          </GuideSection>

          <GuideSection heading={copy.harvestHeading}>
            <p>{copy.harvestSign}</p>
            {latestNotes.length > 0 && (
              <>
                <p className="mt-6">{copy.journalLead}</p>
                <ul className="mt-3 space-y-3">
                  {latestNotes.map((entry) => (
                    <li key={entry.slug}>
                      <GuideLink href={routes.journalEntry(entry.slug)}>
                        {formatEntryDate(entry.date)} — {entry.observation}
                      </GuideLink>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </GuideSection>

          <GuideSection heading={farmCertificate.title} id="belge">
            <p>{copy.certificateLead}</p>
            <GuideFacts facts={farmCertificate.facts} />
            <p className="mt-4">
              <GuideLink href={`${routes.farm}#sertifika`}>{farmCertificate.viewLabel}</GuideLink>
            </p>
          </GuideSection>

          <GuideClosing
            eyebrow="Kabuklu Badem"
            line={copy.closing}
            primary={{ href: routes.product("kabuklu-badem"), label: "Kabuklu Badem — Mağazada gör →" }}
            links={[
              { href: "/badem", label: "Bademimizi tanıyın" },
              { href: routes.producer("kabia-ciftligi"), label: "Kabia Çiftliği" },
              { href: routes.journal, label: "Saha notları" },
              { href: routes.guides, label: "Rehber" },
            ]}
          />
        </div>
      </article>
    </PageShell>
  )
}
