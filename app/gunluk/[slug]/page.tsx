import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { PageShell } from "@/components/layout/page-shell"
import { journalEntries, type JournalEntry } from "@/content/journal"
import { routes } from "@/lib/site"
import { articleJsonLd, breadcrumbJsonLd, pageMetadata } from "@/lib/seo"

function getEntry(slug: string): JournalEntry | undefined {
  return journalEntries.find((e) => e.slug === slug)
}

function formatEntryDate(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })
}

/**
 * The entry's own subject for its title: the first clause of the observation
 * (the H1), with the date — "Dallar tomurcuktan çiçeğe dönüyor — 11 Nisan
 * 2026". A date and the farm name alone said nothing a search could match.
 */
function entryTitle(entry: JournalEntry): string {
  const clause = entry.observation.split(/[;:]/)[0].trim().replace(/[.,]+$/, "")
  return `${clause} — ${formatEntryDate(entry.date)}`
}

/** What was seen and what came of it; pageMetadata trims it to a snippet. */
function entryDescription(entry: JournalEntry): string {
  return `${entry.observation} ${entry.outcome}`
}

export function generateStaticParams() {
  return journalEntries.map((entry) => ({ slug: entry.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const entry = getEntry(slug)
  if (!entry) return { title: "Sayfa bulunamadı", robots: { index: false, follow: false } }
  return pageMetadata({
    title: entryTitle(entry),
    description: entryDescription(entry),
    path: routes.journalEntry(entry.slug),
    image: entry.photo ? { url: entry.photo, alt: entry.observation } : undefined,
    type: "article",
  })
}

function Breadcrumbs({ label, slug }: { label: string; slug: string }) {
  const items = [
    { label: "Ana sayfa", href: routes.home },
    { label: "Günlük", href: routes.journal },
    { label, href: routes.journalEntry(slug) },
  ]
  return (
    <nav aria-label="Breadcrumb" className="mb-8">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink/70">
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-ink/10 py-5">
      <dt className="label text-olive">{label}</dt>
      <dd className="mt-2 text-sm leading-relaxed text-ink/70 md:text-base">{value}</dd>
    </div>
  )
}

export default async function JournalEntryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const entry = getEntry(slug)
  if (!entry) notFound()

  return (
    <PageShell>
      <article className="wrap page-top pb-24 md:pb-32">
        <div className="mx-auto max-w-[42rem]">
          <Breadcrumbs label={formatEntryDate(entry.date)} slug={entry.slug} />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(
                articleJsonLd({
                  headline: entry.observation,
                  description: entryDescription(entry),
                  path: routes.journalEntry(entry.slug),
                  datePublished: entry.date,
                  image: entry.photo,
                }),
              ),
            }}
          />

          <p className="label text-olive">
            <time dateTime={entry.date}>{formatEntryDate(entry.date)}</time>
            <span className="mx-2" aria-hidden="true">
              ·
            </span>
            {entry.location}
          </p>
          <h1 className="mt-5 text-3xl leading-[1.12] tracking-tight md:text-4xl">{entry.observation}</h1>

          {entry.photo && (
            <figure className="mt-10">
              <div className="relative aspect-[4/3] overflow-hidden rounded-media bg-paper">
                <Image
                  src={entry.photo}
                  alt={`${formatEntryDate(entry.date)} — ${entry.location}`}
                  fill
                  sizes="(min-width: 768px) 42rem, 100vw"
                  className="object-cover"
                />
              </div>
            </figure>
          )}

          {entry.video && (
            <figure className="mt-6">
              <video
                src={entry.video}
                controls
                playsInline
                preload="none"
                className="aspect-video w-full rounded-media bg-paper"
              />
            </figure>
          )}

          <dl>
            <Field label="Hava" value={entry.weather} />
            <Field label="Bahçenin durumu" value={entry.orchardState} />
            <Field label="Uygulama" value={entry.application} />
            <Field label="Sonuç" value={entry.outcome} />
          </dl>

          {/* Field notes feed the shop: this orchard's almond and the farm story. */}
          <nav aria-label="İlgili sayfalar" className="mt-10 flex flex-wrap gap-x-8 gap-y-3 border-t border-ink/10 pt-8">
            <Link
              href={routes.product("kabuklu-badem")}
              prefetch={false}
              className="inline-flex min-h-11 items-center gap-2 text-sm text-brand transition-colors duration-300 hover:text-ink"
            >
              Bu bahçenin bademi
              <span aria-hidden="true">→</span>
            </Link>
            <Link
              href={routes.farm}
              prefetch={false}
              className="inline-flex min-h-11 items-center gap-2 text-sm text-brand transition-colors duration-300 hover:text-ink"
            >
              Çiftliği tanı
              <span aria-hidden="true">→</span>
            </Link>
          </nav>
        </div>
      </article>
    </PageShell>
  )
}
