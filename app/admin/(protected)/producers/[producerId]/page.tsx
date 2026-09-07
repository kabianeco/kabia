import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { adminPageContext } from "@/lib/admin/auth"
import {
  countProducerProductReferences,
  loadProducerDetail,
  loadProducerProducts,
} from "@/lib/admin/queries/producers"
import { formatCurrency, formatDateTime, toNumber } from "@/lib/admin/format"
import { InlineAlert, PageHeader, Panel } from "@/components/admin/ui/surfaces"
import { ConfirmAction } from "@/components/admin/ui/confirm-dialog"
import { PublishTag } from "@/components/admin/ui/status"
import { ProducerForm } from "../producer-form"
import {
  deleteProducerAction,
  toggleProducerPublishedAction,
} from "../actions"

export const metadata: Metadata = { title: "Üretici Düzenle" }
export const dynamic = "force-dynamic"

export default async function EditProducerPage({
  params,
  searchParams,
}: {
  params: Promise<{ producerId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { supabase } = await adminPageContext("manageProducers")
  const { producerId } = await params
  const query = await searchParams

  const [producer, products] = await Promise.all([
    loadProducerDetail(supabase, producerId),
    loadProducerProducts(supabase, producerId),
  ])

  if (!producer) notFound()

  const productReferences = await countProducerProductReferences(supabase, producer.id)
  const canHardDelete = productReferences === 0

  return (
    <>
      <PageHeader
        title={producer.name}
        description={`Son güncelleme: ${formatDateTime(producer.createdAt)}`}
        breadcrumbs={[
          { label: "Yönetim", href: "/admin" },
          { label: "Üreticiler", href: "/admin/producers" },
          { label: producer.name },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PublishTag active={producer.isPublished} />

            <Link
              href={`/ureticiler/${producer.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center rounded-full border border-ink/20 px-4 text-sm text-ink transition-colors duration-300 hover:border-brand hover:text-brand"
            >
              Hikâyeyi gör
            </Link>
            <Link
              href={`/magaza/${producer.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center rounded-full border border-ink/20 px-4 text-sm text-ink transition-colors duration-300 hover:border-brand hover:text-brand"
            >
              Mağazada gör
            </Link>

            <ConfirmAction
              trigger={producer.isPublished ? "Yayından kaldır" : "Yayına al"}
              triggerVariant="outline"
              tone={producer.isPublished ? "danger" : "primary"}
              title={producer.isPublished ? "Üreticiyi yayından kaldır" : "Üreticiyi yayına al"}
              description={
                producer.isPublished
                  ? "Üretici /ureticiler ve /secki listelerinden kalkar. Ürünleri ve sipariş geçmişi korunur."
                  : "Üretici listelerde yeniden görünmeye başlar."
              }
              entityName={producer.name}
              confirmLabel={producer.isPublished ? "Yayından kaldır" : "Yayına al"}
              pendingLabel="İşleniyor…"
              action={toggleProducerPublishedAction}
              hiddenFields={{ producerId: producer.id }}
            />

            {canHardDelete && (
              <ConfirmAction
                trigger="Kalıcı sil"
                triggerVariant="danger"
                title="Üreticiyi kalıcı olarak sil"
                description="Bu işlem geri alınamaz. Üretici kaydı veritabanından silinir. Onaylamak için üreticinin kısa adını yazın."
                entityName={producer.name}
                typedConfirmation={producer.slug}
                confirmLabel="Kalıcı olarak sil"
                pendingLabel="Siliniyor…"
                action={deleteProducerAction}
                hiddenFields={{ producerId: producer.id }}
              />
            )}
          </div>
        }
      />

      <div className="mb-6 space-y-3">
        {query.kayit === "1" && (
          <InlineAlert tone="success">Üretici kaydedildi ve mağazaya yansıtıldı.</InlineAlert>
        )}
        {query.yayin === "1" && (
          <InlineAlert tone="success">Yayın durumu güncellendi.</InlineAlert>
        )}
        {query.hata === "urun-referansi" && (
          <InlineAlert tone="danger">
            Bu üreticiye bağlı {productReferences} ürün var. Üretici silinemez —
            önce ürünleri başka bir üreticiye bağlayın veya yayından kaldırın.
          </InlineAlert>
        )}
        {query.hata === "silinemedi" && (
          <InlineAlert tone="danger">Üretici silinemedi. Lütfen tekrar deneyin.</InlineAlert>
        )}

        {!canHardDelete && (
          <InlineAlert tone="info">
            Bu üreticiye bağlı {productReferences} ürün var. Ürün geçmişini
            korumak için kalıcı silme kapalıdır — listelerden çıkarmak için
            yayından kaldırın.
          </InlineAlert>
        )}
      </div>

      <ProducerForm producer={producer} />

      <div className="mt-6">
        <Panel
          title={`Bu üreticinin ürünleri (${products.length})`}
          description="Ürün ataması ürün düzenleyiciden yapılır; burası salt listedir."
          bodyClassName="px-0 py-0 md:px-0"
        >
          {products.length === 0 ? (
            <p className="px-4 py-6 text-sm text-ink/45 md:px-5">
              Bu üreticiye bağlı ürün yok.
            </p>
          ) : (
            <ul className="divide-y divide-ink/[0.07]">
              {products.map((product) => (
                <li
                  key={product.id}
                  className="flex flex-wrap items-center gap-4 px-4 py-3 md:px-5"
                >
                  <span className="min-w-0 flex-1">
                    <Link
                      href={`/admin/products/${product.id}`}
                      prefetch={false}
                      className="block truncate text-sm text-ink transition-colors duration-200 hover:text-brand"
                    >
                      {product.name}
                    </Link>
                    <span className="figure mt-0.5 block text-xs text-ink/45">
                      {formatCurrency(toNumber(product.basePrice))}
                    </span>
                  </span>
                  <PublishTag active={product.isActive} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  )
}
