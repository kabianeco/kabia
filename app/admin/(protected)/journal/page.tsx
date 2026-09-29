import type { Metadata } from "next"
import Link from "next/link"
import { adminPageContext } from "@/lib/admin/auth"
import { loadJournalList } from "@/lib/admin/queries/journal"
import { formatDate } from "@/lib/admin/format"
import { InlineAlert, PageHeader, Panel } from "@/components/admin/ui/surfaces"
import { PublishTag } from "@/components/admin/ui/status"
import { Table, TableScroll, Td, Th, Tr } from "@/components/admin/ui/table"

export const metadata: Metadata = { title: "Günlük" }
export const dynamic = "force-dynamic"

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { supabase } = await adminPageContext("manageJournal")
  const entries = await loadJournalList(supabase)
  const query = await searchParams

  return (
    <>
      <PageHeader
        title="Günlük"
        description="Bahçenin saha notları. /gunluk, sitemap ve badem bahçesi rehberi bu kayıtları okur."
        breadcrumbs={[{ label: "Yönetim", href: "/admin" }, { label: "Günlük" }]}
        actions={
          <Link
            href="/admin/journal/new"
            prefetch={false}
            className="inline-flex min-h-11 items-center rounded-full bg-brand px-5 text-sm text-on-brand transition-colors duration-300 hover:bg-forest"
          >
            Yeni not
          </Link>
        }
      />

      <div className="mb-6 space-y-3">
        {query.silindi === "1" && <InlineAlert tone="success">Günlük notu silindi.</InlineAlert>}
      </div>

      <Panel title="Tüm notlar" bodyClassName="px-0 py-0 md:px-0">
        <div className="px-4 py-4 md:px-5">
          <TableScroll>
            <Table caption="Günlük notları">
              <thead>
                <tr>
                  <Th>Not</Th>
                  <Th>Tarih</Th>
                  <Th align="right">Görsel</Th>
                  <Th>Durum</Th>
                  <Th align="right">
                    <span className="sr-only">İşlemler</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <Tr key={entry.id}>
                    <Td>
                      <Link
                        href={`/admin/journal/${entry.id}`}
                        prefetch={false}
                        className="block max-w-md truncate font-medium text-ink transition-colors duration-200 hover:text-brand"
                      >
                        {entry.observation}
                      </Link>
                      <span className="text-sm text-ink/60">
                        /{entry.slug}
                        {entry.hasVideo && " · videolu"}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-sm text-ink/70">{formatDate(entry.entryDate)}</span>
                    </Td>
                    <Td align="right" numeric>
                      {entry.imageCount}
                    </Td>
                    <Td>
                      <PublishTag active={entry.isPublished} />
                    </Td>
                    <Td align="right">
                      <Link
                        href={`/admin/journal/${entry.id}`}
                        prefetch={false}
                        className="inline-flex min-h-11 items-center rounded-full border border-ink/15 px-4 text-sm text-ink/65 transition-colors duration-300 hover:border-brand hover:text-brand"
                      >
                        Düzenle
                      </Link>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableScroll>

          {entries.length === 0 && (
            <p className="py-8 text-center text-sm text-ink/45">Henüz not yok. Yeni not ekleyerek başlayın.</p>
          )}
        </div>
      </Panel>

      <p className="mt-4 text-xs text-ink/45">
        Yayındaki bir not silinemez — önce yayından kaldırın. Yayından kaldırılan not listeden ve sitemap&apos;ten
        düşer; adresi (kısa ad) hiçbir zaman değişmez.
      </p>
    </>
  )
}
