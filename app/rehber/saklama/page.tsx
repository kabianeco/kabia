import type { Metadata } from "next"
import { PageShell } from "@/components/layout/page-shell"
import { GuideClosing, GuideFacts, GuideHeader, GuideLink, GuideSection } from "@/components/guides/guide-parts"
import { guideBySlug, storageGuideCopy as copy } from "@/content/guides"
import { getCachedPublicProducts } from "@/lib/catalog"
import { PRODUCT_SOURCES, SOURCES } from "@/lib/products"
import { routes } from "@/lib/site"
import { articleJsonLd, pageMetadata } from "@/lib/seo"

const guide = guideBySlug("saklama")!

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: guide.metaTitle,
    description: guide.description,
    path: routes.guide(guide.slug),
    type: "article",
    keywords: guide.keywords,
  })
}

/** "Serin ve kuru yerde" → "Serin ve kuru yerde." — the stored text, as a sentence. */
function asSentence(text: string): string {
  const trimmed = text.trim()
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

/**
 * How to store each product, one question-shaped heading per product (the way
 * storage searches are asked). The answer is the product's own
 * `storage_conditions`, then its `shelf_life` and sizes — the same catalogue
 * row its product page reads, so the two cannot drift. Nothing is added that
 * the catalogue does not store (no after-opening or refrigeration advice).
 */
export default async function StorageGuidePage() {
  const result = await getCachedPublicProducts()
  if (result.status !== "ok") throw new Error("[rehber/saklama] catalogue read failed")
  const groups = PRODUCT_SOURCES.map((source) => ({
    label: SOURCES.find((s) => s.id === source)?.badgeLabel ?? source,
    products: result.products.filter((product) => product.source === source && product.storage),
  })).filter((group) => group.products.length > 0)

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
            { label: "Saklama", href: routes.guide(guide.slug) },
          ]}
          eyebrow={guide.eyebrow}
          heading={guide.heading}
          intro={copy.intro}
        />

        <div className="wrap">
          {groups.map((group) => (
            <section key={group.label} aria-label={group.label}>
              <p className="label border-t border-ink/10 pt-6 text-olive">{group.label}</p>
              {group.products.map((product) => (
                <GuideSection key={product.slug} heading={`${product.name} nasıl saklanır?`} id={product.slug}>
                  <p>{asSentence(product.storage)}</p>
                  <GuideFacts
                    facts={[
                      ...(product.shelfLife ? [{ label: copy.shelfLife, value: product.shelfLife }] : []),
                      ...(product.variants.length > 0
                        ? [{ label: copy.sizes, value: product.variants.map((variant) => variant.weight).join(" · ") }]
                        : []),
                    ]}
                  />
                  <p className="mt-4">
                    <GuideLink href={routes.product(product.slug)}>
                      {copy.productLink}: {product.name}
                    </GuideLink>
                  </p>
                </GuideSection>
              ))}
            </section>
          ))}

          <GuideClosing
            eyebrow="Mağaza"
            line={copy.closing}
            primary={{ href: routes.store, label: "Mağazaya git →" }}
            links={[
              { href: routes.guide("uretici-secimi"), label: "Üreticilerimizi nasıl seçiyoruz" },
              { href: routes.guides, label: "Rehber" },
            ]}
          />
        </div>
      </article>
    </PageShell>
  )
}
