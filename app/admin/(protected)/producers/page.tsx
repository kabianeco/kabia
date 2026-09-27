import type { Metadata } from "next"
import Link from "next/link"
import { adminPageContext } from "@/lib/admin/auth"
import { loadProducerList } from "@/lib/admin/queries/producers"
import { InlineAlert, PageHeader, Panel } from "@/components/admin/ui/surfaces"
import { PublishTag } from "@/components/admin/ui/status"
import { Table, TableScroll, Td, Th, Tr } from "@/components/admin/ui/table"

export const metadata: Metadata = { title: "Üreticiler" }
export const dynamic = "force-dynamic"

const SOURCE_LABELS: Record<string, string> = {
  ciftlik: "Kabia Çiftliği",
  secki: "Kabia Seçki",
  mutfak: "Kabia Mutfak",
}

export default async function ProducersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { supabase } = await adminPageContext("manageProducers")
  const producers = await loadProducerList(supabase)
  const query = await searchParams

  return (
    <>
      <PageHeader
        title="Üreticiler"
        description="Kabia'nın ürün aldığı üreticiler. /ureticiler, /secki ve üretici mağazaları bu kayıtları okur."
        breadcrumbs={[{ label: "Yönetim", href: "/admin" }, { label: "Üreticiler" }]}
        actions={
          <Link
            href="/admin/producers/new"
            prefetch={false}
            className="inline-flex min-h-11 items-center rounded-full bg-brand px-5 text-sm text-on-brand transition-colors duration-300 hover:bg-forest"
          >
            Yeni üretici
          </Link>
        }
      />

      <div className="mb-6 space-y-3">
        {query.silindi === "1" && (
          <InlineAlert tone="success">Üretici silindi.</InlineAlert>
        )}
      </div>

      <Panel title="Tüm üreticiler" bodyClassName="px-0 py-0 md:px-0">
        <div className="px-4 py-4 md:px-5">
          <TableScroll>
            <Table caption="Üretici listesi">
              <thead>
                <tr>
                  <Th>Üretici</Th>
                  <Th>Kaynak</Th>
                  <Th align="right">Sıra</Th>
                  <Th align="right">Ürün</Th>
                  <Th>Durum</Th>
                  <Th align="right">
                    <span className="sr-only">İşlemler</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {producers.map((producer) => (
                  <Tr key={producer.id}>
                    <Td>
                      <Link
                        href={`/admin/producers/${producer.id}`}
                        prefetch={false}
                        className="block font-medium text-ink transition-colors duration-200 hover:text-brand"
                      >
                        {producer.name}
                      </Link>
                      <span className="text-sm text-ink/60">/{producer.slug}</span>
                    </Td>
                    <Td>
                      <span className="text-sm text-ink/70">
                        {producer.source ? (SOURCE_LABELS[producer.source] ?? producer.source) : "—"}
                      </span>
                    </Td>
                    <Td align="right" numeric>
                      {producer.sortOrder}
                    </Td>
                    <Td align="right" numeric>
                      {producer.productCount}
                    </Td>
                    <Td>
                      <PublishTag active={producer.isPublished} />
                    </Td>
                    <Td align="right">
                      <Link
                        href={`/admin/producers/${producer.id}`}
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

          {producers.length === 0 && (
            <p className="py-8 text-center text-sm text-ink/45">
              Henüz üretici yok. Yeni üretici ekleyerek başlayın.
            </p>
          )}
        </div>
      </Panel>

      <p className="mt-4 text-xs text-ink/45">
        Ürünü olan bir üretici silinemez — önce ürünlerini başka bir üreticiye
        bağlayın veya yayından kaldırın. Yayından kaldırmak listelerden düşürür,
        ürünleri ve sipariş geçmişini korur.
      </p>
    </>
  )
}
