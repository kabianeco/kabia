import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { PageShell } from "@/components/layout/page-shell"
import { getCachedPublishedJournal, journalNeighbours, type JournalEntry } from "@/lib/journal"
import { routes } from "@/lib/site"
import { articleJsonLd, pageMetadata, serializeJsonLd } from "@/lib/seo"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"

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

/** The alt text an image carries when an editor has not written one. */
function fallbackAlt(entry: JournalEntry): string {
  return `${formatEntryDate(entry.date)} — ${entry.location}`
}

function altFor(entry: JournalEntry, url: string): string {
  return entry.gallery.find((image) => image.url === url)?.altText?.trim() || fallbackAlt(entry)
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const result = await getCachedPublishedJournal()
  // An unreadable journal must not be indexed as if the page did not exist or
  // as if it were the page: it is neither.
  if (result.status === "error") {
    return { title: "Saha notları şu anda yüklenemiyor", robots: { index: false, follow: false } }
  }
  const entry = result.entries.find((e) => e.slug === slug)
  if (!entry) return { title: "Sayfa bulunamadı", robots: { index: false, follow: false } }
  return pageMetadata({
    title: entryTitle(entry),
    description: entryDescription(entry),
    path: routes.journalEntry(entry.slug),
    image: entry.photo ? { url: entry.photo, alt: entry.observation } : undefined,
    type: "article",
  })
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
  const result = await getCachedPublishedJournal()

  if (result.status === "error") {
    return (
      <PageShell>
        <div role="alert" className="wrap page-top flex min-h-[50vh] flex-col items-start pb-24">
          <p className="font-theme-display text-3xl italic text-clay">Saha notu şu anda yüklenemiyor.</p>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink/55">Lütfen daha sonra yeniden deneyin.</p>
        </div>
      </PageShell>
    )
  }

  const entry = result.entries.find((e) => e.slug === slug)
  if (!entry) notFound()
  const { previous, next } = journalNeighbours(result.entries, entry.slug)
  // Gallery images after the cover, in the order the editor set. Entries
  // migrated from the old file have only a cover, so this is empty for them.
  const extraImages = entry.gallery.filter((image) => image.url !== entry.photo)

  return (
    <PageShell>
      <article className="wrap page-top pb-24 md:pb-32">
        <div className="mx-auto max-w-[42rem]">
          <Breadcrumbs
            items={[
              { label: "Ana sayfa", href: routes.home },
              { label: "Günlük", href: routes.journal },
              { label: formatEntryDate(entry.date), href: routes.journalEntry(entry.slug) },
            ]}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: serializeJsonLd(
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
                  alt={altFor(entry, entry.photo)}
                  fill
                  sizes="(min-width: 768px) 42rem, 100vw"
                  className="object-cover"
                />
              </div>
            </figure>
          )}

          {extraImages.map((image) => (
            <figure key={image.url} className="mt-6">
              <div className="relative aspect-[4/3] overflow-hidden rounded-media bg-paper">
                <Image
                  src={image.url}
                  alt={image.altText?.trim() || fallbackAlt(entry)}
                  fill
                  sizes="(min-width: 768px) 42rem, 100vw"
                  className="object-cover"
                />
              </div>
            </figure>
          ))}

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

          {/* Walk the log in date order, in the same link style. */}
          {(previous || next) && (
            <nav aria-label="Günlük notları" className="mt-6 flex flex-wrap justify-between gap-x-8 gap-y-3 border-t border-ink/10 pt-8">
              {previous ? (
                <Link
                  href={routes.journalEntry(previous.slug)}
                  prefetch={false}
                  className="inline-flex min-h-11 items-center gap-2 text-sm text-brand transition-colors duration-300 hover:text-ink"
                >
                  <span aria-hidden="true">←</span>
                  Önceki not: {formatEntryDate(previous.date)}
                </Link>
              ) : <span />}
              {next ? (
                <Link
                  href={routes.journalEntry(next.slug)}
                  prefetch={false}
                  className="inline-flex min-h-11 items-center gap-2 text-sm text-brand transition-colors duration-300 hover:text-ink"
                >
                  Sonraki not: {formatEntryDate(next.date)}
                  <span aria-hidden="true">→</span>
                </Link>
              ) : null}
            </nav>
          )}
        </div>
      </article>
    </PageShell>
  )
}
