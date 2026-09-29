import type { Metadata } from "next"
import { pageMetadata } from "@/lib/seo"
import Image from "next/image"
import Link from "next/link"
import { PageShell } from "@/components/layout/page-shell"
import { getCachedPublishedJournal, type JournalEntry } from "@/lib/journal"
import { routes } from "@/lib/site"

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Saha Notları — Geyve Badem Bahçesinden",
    description:
      "Günlük kısa saha notları arşivi: konum, hava, uygulama ve gözlem. Çiftliğin uzun hikâyesi /ciftlik kronolojisinde.",
    path: "/gunluk",
  })
}

function formatEntryDate(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })
}

function seasonOf(iso: string): string {
  const month = Number(iso.slice(5, 7))
  const year = iso.slice(0, 4)
  const season =
    month >= 3 && month <= 5 ? "İlkbahar" : month >= 6 && month <= 8 ? "Yaz" : month >= 9 && month <= 11 ? "Sonbahar" : "Kış"
  return `${season} ${year}`
}

function JournalHeading() {
  return (
    <>
      <div className="wrap page-top pb-16 md:pb-24">
        <p className="label text-olive">Arşiv</p>
        <h1 id="journal-heading" className="mt-6 max-w-3xl text-4xl leading-[1.08] tracking-tight md:text-6xl">
          Saha <em className="font-theme-display italic text-brand">notları</em>.
        </h1>
        <p className="mt-7 max-w-md text-base leading-relaxed text-ink/65">
          Kısa saha notları: konum, hava, uygulama ve gözlem. Çiftliğin
          uzun hikâyesi kronolojide anlatılıyor.
        </p>
        <Link
          href={routes.farm}
          prefetch={false}
          className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm text-brand transition-colors duration-300 hover:text-ink"
        >
          Çiftlik kronolojisini gör
          <span aria-hidden="true">→</span>
        </Link>
        <Link
          href={routes.product("kabuklu-badem")}
          prefetch={false}
          className="mt-5 ml-8 inline-flex min-h-11 items-center gap-2 text-sm text-brand transition-colors duration-300 hover:text-ink"
        >
          Bu bahçenin bademi
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </>
  )
}

/**
 * Shown when the journal cannot be read. An outage is not an empty archive:
 * the visitor is told the notes are unavailable rather than that none exist.
 */
function JournalOutage() {
  return (
    <PageShell>
      <section aria-labelledby="journal-heading">
        <JournalHeading />
        <div role="alert" className="wrap flex flex-col items-start pb-24 md:pb-32">
          <p className="font-theme-display text-3xl italic text-clay">
            Saha notları şu anda yüklenemiyor.
          </p>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink/55">
            Lütfen daha sonra yeniden deneyin.
          </p>
        </div>
      </section>
    </PageShell>
  )
}

export default async function JournalIndexPage() {
  const result = await getCachedPublishedJournal()
  if (result.status === "error") return <JournalOutage />

  const entries = [...result.entries].sort((a, b) => (a.date < b.date ? 1 : -1))
  const groups = new Map<string, JournalEntry[]>()
  for (const entry of entries) {
    const key = seasonOf(entry.date)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(entry)
  }

  return (
    <PageShell>
      <section aria-labelledby="journal-heading">
        <JournalHeading />

        <div className="wrap">
          {entries.length === 0 ? (
            <div className="py-24 text-center">
              <p className="font-theme-display text-2xl italic text-ink/70">Günlük şu an boş.</p>
              <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-ink/55">
                Yeni saha notları eklendiğinde burada, tarih sırasıyla listelenir.
                Bu arada çiftliğin 2019&apos;dan bugüne kronolojisi hazır:
              </p>
              <Link
                href={routes.farm}
                prefetch={false}
                className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm text-brand transition-colors duration-300 hover:text-ink"
              >
                Çiftlik kronolojisini gör
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          ) : (
            <div className="pb-24 md:pb-32">
              {[...groups].map(([season, seasonEntries]) => (
                <section key={season} aria-label={season} className="mt-14 first:mt-0">
                  <h2 className="label text-olive">{season}</h2>
                  <ul>
                    {seasonEntries.map((entry) => (
                      <li key={entry.slug} className="border-t border-ink/10 py-8 first:mt-6 md:py-10">
                        <Link href={routes.journalEntry(entry.slug)} prefetch={false} className="group grid gap-5 sm:grid-cols-[160px_1fr] sm:items-center">
                          {entry.photo ? (
                            <span className="relative block aspect-[4/3] overflow-hidden rounded-xl bg-paper">
                              <Image
                                src={entry.photo}
                                alt=""
                                fill
                                sizes="160px"
                                className="object-cover"
                              />
                            </span>
                          ) : null}
                          <span className="block min-w-0">
                          <p className="label text-olive">
                            <time dateTime={entry.date}>{formatEntryDate(entry.date)}</time>
                            <span className="mx-2" aria-hidden="true">
                              ·
                            </span>
                            {entry.location}
                          </p>
                          <p className="mt-3 text-xl leading-snug tracking-tight transition-colors duration-300 group-hover:text-brand md:text-2xl">
                            {entry.observation}
                          </p>
                          <span className="label mt-3 inline-block rounded-full border border-ink/10 bg-paper px-3 py-1.5 text-ink/65">
                            {entry.weather}
                          </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </section>
    </PageShell>
  )
}
