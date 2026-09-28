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
import { guideBySlug, selectionGuideCopy as copy } from "@/content/guides"
import { kabiaStandard } from "@/content/kabia-standard"
import { farmCertificate } from "@/content/farm"
import { getCachedPublicProducts } from "@/lib/catalog"
import { getCachedPublicProducers } from "@/lib/producers"
import { PRODUCT_SOURCES, type Product } from "@/lib/products"
import { routes } from "@/lib/site"
import { articleJsonLd, pageMetadata } from "@/lib/seo"

const guide = guideBySlug("uretici-secimi")!

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: guide.metaTitle,
    description: guide.description,
    path: routes.guide(guide.slug),
    type: "article",
    keywords: guide.keywords,
  })
}

/** The producer's own "why we chose it" sentence, verbatim from the story. */
function whySelected(story: string | null): string | null {
  return story?.match(/Biz Kabia['’]da[^.]*seçtik:[^.]*\./)?.[0] ?? null
}

/**
 * The certificate line for a product. A certified product's status is read
 * from content/farm.ts — the one place the certificate is stated, so its
 * number and validity change there and here together. Every other product
 * shows its own `certifications` text as the catalogue stores it.
 */
function certificateLine(product: Product): string {
  if (product.certification === "organik_sertifikali") {
    const fact = (label: string) => farmCertificate.facts.find((f) => f.label === label)?.value ?? ""
    return `Organik tarım müteşebbis sertifikası ${fact("Sertifika no")} — geçerlilik: ${fact("Geçerlilik")}.`
  }
  return product.certificates
}

/**
 * How Kabia chooses its producers: the Kabia Standardı criteria verbatim,
 * the three sources, a live product → producer → place → certificate table,
 * and what the labels mean (the standard's own note, then the certificate
 * from content/farm.ts). A failed catalogue read throws to the error page
 * rather than presenting an empty table as the truth.
 */
export default async function SelectionGuidePage() {
  const [productsResult, producersResult] = await Promise.all([getCachedPublicProducts(), getCachedPublicProducers()])
  if (productsResult.status !== "ok" || producersResult.status !== "ok") {
    throw new Error("[rehber/uretici-secimi] catalogue read failed")
  }
  const producers = new Map(producersResult.producers.map((producer) => [producer.slug, producer]))
  const products = [...productsResult.products].sort(
    (a, b) => PRODUCT_SOURCES.indexOf(a.source) - PRODUCT_SOURCES.indexOf(b.source),
  )

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
              }),
            ),
          }}
        />
        <GuideHeader
          crumbs={[
            { label: "Ana sayfa", href: routes.home },
            { label: "Rehber", href: routes.guides },
            { label: kabiaStandard.name, href: routes.guide(guide.slug) },
          ]}
          eyebrow={guide.eyebrow}
          heading={guide.heading}
          intro={kabiaStandard.lead}
        />

        <div className="wrap">
          <GuideSteps
            steps={kabiaStandard.criteria.map((criterion, index) => ({
              key: criterion,
              marker: String(index + 1).padStart(2, "0"),
              title: criterion,
              body: null,
            }))}
          />
          <div className="border-t border-ink/10 py-16 text-center md:py-20">
            <p className="mx-auto max-w-xl font-theme-display text-2xl italic leading-snug md:text-4xl">
              {kabiaStandard.closing}
            </p>
          </div>

          <GuideSection heading={copy.sourcesHeading} />
          <GuideNotes
            notes={copy.sources.map((source) => ({
              title: source.name,
              body: (
                <>
                  <p>{source.line}</p>
                  <p className="mt-2">
                    <GuideLink href={source.href}>{source.name}</GuideLink>
                  </p>
                </>
              ),
            }))}
          />

          <GuideSection heading={copy.whoHeading}>
            <p>{copy.whoLead}</p>
          </GuideSection>
          <GuideSteps
            steps={products.map((product) => {
              const producer = producers.get(product.producerSlug)
              const why = whySelected(producer?.story ?? null)
              return {
                key: product.slug,
                marker: "·",
                title: product.name,
                body: (
                  <>
                    {/* The producer's name only: its region repeats the name for
                        most producers, and one (ıhlamur) carries a place still
                        in dispute (bahçe / orman). */}
                    {producer && producer.name !== product.name ? <p>{producer.name}</p> : null}
                    <p className="mt-2">{certificateLine(product)}</p>
                    {why ? <p className="mt-2">“{why}”</p> : null}
                    <p className="mt-2 flex flex-wrap gap-x-6">
                      <GuideLink href={routes.product(product.slug)}>{product.name}</GuideLink>
                      {producer ? <GuideLink href={routes.producer(producer.slug)}>{producer.name}</GuideLink> : null}
                    </p>
                  </>
                ),
              }
            })}
          />

          <GuideSection heading={copy.labelsHeading} id="etiketler">
            <p>{kabiaStandard.certificationNote}</p>
            <p className="mt-6">{copy.certificateLead}</p>
            <GuideFacts facts={farmCertificate.facts} />
            <p className="mt-4">
              <GuideLink href={`${routes.farm}#sertifika`}>{farmCertificate.viewLabel}</GuideLink>
            </p>
          </GuideSection>

          <GuideClosing
            eyebrow={kabiaStandard.name}
            line={copy.closing}
            links={[
              { href: routes.producers, label: "Üreticiler" },
              { href: routes.secki, label: "Seçki" },
              { href: routes.mutfak, label: "Mutfak" },
              { href: routes.guides, label: "Rehber" },
            ]}
          />
        </div>
      </article>
    </PageShell>
  )
}
