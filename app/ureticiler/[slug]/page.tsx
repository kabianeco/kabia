import { cache } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { PageShell } from "@/components/layout/page-shell"
import { ProductEntry } from "@/components/shop/product-entry"
import { getCachedProducerBySlug, splitStoryParagraphs, type Producer } from "@/lib/producers"
import { getCachedProducerProducts } from "@/lib/catalog"
import type { Product } from "@/lib/products"
import { sourceProducers } from "@/content/producers"
import { previewProducts } from "@/content/preview-products"
import { isBrandPreview } from "@/lib/brand-preview"
import { isAllowedImageUrl } from "@/lib/shop-banner"
import { routes } from "@/lib/site"
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo"

/** One React cache() read per request, shared between generateMetadata and the page body. */
const getProducer = cache(async (slug: string) => {
  if (isBrandPreview()) {
    const producer = sourceProducers.find((producer) => producer.slug === slug)
    return producer ? { status: "ok" as const, producer } : { status: "not_found" as const }
  }
  return getCachedProducerBySlug(slug)
})

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const result = await getProducer(slug)
  if (result.status !== "ok") return { title: "Üretici", robots: { index: false, follow: false } }

  const producer = result.producer
  // §8.2: the administered tagline surfaces invisibly in the meta
  // description (magaza shelf pattern); preview rows carry desc instead.
  const tagline = "tagline" in producer && typeof producer.tagline === "string" ? producer.tagline : null
  const storyFallback = `${producer.name} — Kabia'nın güvendiği üreticilerden.`
  const metadata = await pageMetadata({
    title: producer.name,
    description: tagline ? `${producer.story ?? storyFallback} ${tagline}` : (producer.story ?? storyFallback),
    path: routes.producer(producer.slug),
    // No image here: app/ureticiler/[slug]/opengraph-image.tsx serves the
    // single branded 1200×630 card (real photo embedded).
    type: "article",
  })
  return isBrandPreview() ? { ...metadata, robots: { index: false, follow: false } } : metadata
}

function Breadcrumbs({ name, slug }: { name: string; slug: string }) {
  const items = [
    { label: "Ana sayfa", href: routes.home },
    { label: "Üreticiler", href: routes.producers },
    { label: name, href: routes.producer(slug) },
  ]
  return (
    <nav aria-label="Breadcrumb" className="mb-8">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink/45">
        {items.map((item, i) => (
          <li key={item.href} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden="true">/</span>}
            {i === items.length - 1 ? (
              <span aria-current="page" className="truncate text-ink/60">
                {item.label}
              </span>
            ) : (
              <Link href={item.href} prefetch={false} className="transition-colors duration-300 hover:text-ink">
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
      {/* The same trail, for search engines — built from the visible items. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd(items.map((item) => [item.label, item.href] as const))),
        }}
      />
    </nav>
  )
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div className="border-t border-ink/10 py-5">
      <dt className="label text-olive">{label}</dt>
      <dd className="mt-2 text-sm leading-relaxed text-ink/70 md:text-base">{value}</dd>
    </div>
  )
}

export default async function ProducerDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const result = await getProducer(slug)

  if (result.status === "error") {
    return (
      <PageShell>
        <div role="alert" className="wrap page-top flex min-h-[50vh] flex-col items-start pb-24">
          <p className="font-theme-display text-3xl italic text-clay">Üretici profili şu anda yüklenemiyor.</p>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink/55">Lütfen daha sonra yeniden deneyin.</p>
        </div>
      </PageShell>
    )
  }

  if (result.status === "not_found") notFound()

  if (result.status !== "ok") notFound()
  // Database rows carry the administered tagline/sortOrder; the preview
  // content file carries desc instead. Only the shared fields render visibly;
  // the tagline additionally feeds the meta description above.
  const producer: Omit<Producer, "createdAt" | "tagline" | "sortOrder"> = result.producer
  const products: Product[] = isBrandPreview()
    ? previewProducts.filter((product) => product.producerSlug === producer.slug)
    : await getCachedProducerProducts(producer.id)

  return (
    <PageShell>
      <article className="wrap page-top pb-24 md:pb-32">
        <div className="mx-auto max-w-[42rem]">
          <Breadcrumbs name={producer.name} slug={producer.slug} />

          {producer.productType && <p className="label text-olive">{producer.productType}</p>}
          <h1 className="mt-5 text-4xl leading-[1.08] tracking-tight md:text-5xl">{producer.name}</h1>
          {producer.region && <p className="mt-6 text-lg leading-relaxed text-ink/65">{producer.region}</p>}
        </div>

        {producer.photoUrl && isAllowedImageUrl(producer.photoUrl) && (
          <div className="relative mx-auto mt-10 aspect-[16/9] max-w-4xl overflow-hidden rounded-media bg-paper md:mt-14">
            <Image src={producer.photoUrl} alt={producer.name} fill sizes="(min-width: 1024px) 56rem, 100vw" className="object-cover" priority fetchPriority="high" />
          </div>
        )}

        <div className="mx-auto mt-10 max-w-[42rem] md:mt-14">
          {/* §5.7: stored blank-line-separated paragraphs render as
              paragraphs, in the existing text style. */}
          {producer.story && (
            <div className="space-y-6">
              {splitStoryParagraphs(producer.story).map((paragraph, i) => (
                <p key={i} className="text-base leading-relaxed text-ink/70 md:text-lg">
                  {paragraph}
                </p>
              ))}
            </div>
          )}

          <dl>
            <Field label="Üretim yeri" value={producer.productionPlace} />
            <Field label="Yöntem" value={producer.method} />
            <Field label="Girdiler" value={producer.inputs} />
            <Field label="Belgeler" value={producer.certificates} />
            <Field label="Neden Kabia'nın üreticisi" value={producer.whySelected} />
          </dl>
        </div>

        {products.length > 0 && (
          <div className="mx-auto mt-20 max-w-[42rem] border-t border-ink/10 pt-14 md:mt-28">
            <p className="label text-olive">Ürünleri</p>
            <ul className="mt-6 grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2">
              {products.map((product) => (
                <ProductEntry key={product.slug} product={product} />
              ))}
            </ul>
            {/* The producer's shelf: keeps /magaza/<slug> linked, not sitemap-only. */}
            <Link
              href={`/magaza/${producer.slug}`}
              prefetch={false}
              className="mt-10 inline-flex min-h-11 items-center gap-2 text-sm text-brand transition-colors duration-300 hover:text-ink"
            >
              Mağazada tümünü gör
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        )}
      </article>
    </PageShell>
  )
}
