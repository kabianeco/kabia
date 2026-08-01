import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { adminPageContext } from "@/lib/admin/auth"
import {
  countOrderReferences,
  loadCategories,
  loadProductDetail,
} from "@/lib/admin/queries/products"
import { formatDateTime } from "@/lib/admin/format"
import { InlineAlert, PageHeader } from "@/components/admin/ui/surfaces"
import { ConfirmAction } from "@/components/admin/ui/confirm-dialog"
import { PublishTag } from "@/components/admin/ui/status"
import { ProductForm } from "../product-form"
import { archiveProductAction, deleteProductAction, restoreProductAction } from "../actions"

export const metadata: Metadata = { title: "Ürün Düzenle" }
export const dynamic = "force-dynamic"

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { supabase } = await adminPageContext("manageCatalogue")
  const { productId } = await params
  const query = await searchParams

  const [product, categories] = await Promise.all([
    loadProductDetail(supabase, productId),
    loadCategories(supabase),
  ])

  if (!product) notFound()

  const orderReferences = await countOrderReferences(supabase, product.id)
  const canHardDelete = orderReferences === 0

  return (
    <>
      <PageHeader
        title={product.name}
        description={`Son güncelleme: ${formatDateTime(product.updatedAt)}`}
        breadcrumbs={[
          { label: "Yönetim", href: "/admin" },
          { label: "Ürünler", href: "/admin/products" },
          { label: product.name },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PublishTag active={product.isActive} />

            <Link
              href={`/shop/${product.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center rounded-full border border-ink/20 px-4 text-sm text-ink transition-colors duration-300 hover:border-brand hover:text-brand"
            >
              Mağazada gör
            </Link>

            {product.isActive ? (
              <ConfirmAction
                trigger="Arşivle"
                triggerVariant="outline"
                title="Ürünü arşivle"
                description="Ürün mağazadan kaldırılır ve öne çıkanlardan çıkarılır. Sipariş geçmişi olduğu gibi korunur; istediğiniz zaman yeniden yayına alabilirsiniz."
                entityName={product.name}
                confirmLabel="Arşivle"
                pendingLabel="Arşivleniyor…"
                action={archiveProductAction}
                hiddenFields={{ productId: product.id }}
              />
            ) : (
              <ConfirmAction
                trigger="Yayına al"
                triggerVariant="outline"
                tone="primary"
                title="Ürünü yayına al"
                description="Ürün mağazada yeniden listelenmeye başlar."
                entityName={product.name}
                confirmLabel="Yayına al"
                pendingLabel="Yayınlanıyor…"
                action={restoreProductAction}
                hiddenFields={{ productId: product.id }}
              />
            )}

            {canHardDelete && (
              <ConfirmAction
                trigger="Kalıcı sil"
                triggerVariant="danger"
                title="Ürünü kalıcı olarak sil"
                description="Bu işlem geri alınamaz. Ürün, tüm seçenekleri ve görsel kayıtlarıyla birlikte veritabanından silinir. Onaylamak için ürünün kısa adını yazın."
                entityName={product.name}
                typedConfirmation={product.slug}
                confirmLabel="Kalıcı olarak sil"
                pendingLabel="Siliniyor…"
                action={deleteProductAction}
                hiddenFields={{ productId: product.id }}
              />
            )}
          </div>
        }
      />

      <div className="mb-6 space-y-3">
        {query.kayit === "1" && (
          <InlineAlert tone="success">Ürün kaydedildi ve mağazaya yansıtıldı.</InlineAlert>
        )}
        {query.arsiv === "1" && (
          <InlineAlert tone="warning">Ürün arşivlendi; mağazada artık görünmüyor.</InlineAlert>
        )}
        {query.yayin === "1" && (
          <InlineAlert tone="success">Ürün yeniden yayına alındı.</InlineAlert>
        )}
        {query.hata === "siparis-referansi" && (
          <InlineAlert tone="danger">
            Bu ürün sipariş geçmişinde kullanıldığı için kalıcı olarak silinemez. Bunun
            yerine arşivleyin.
          </InlineAlert>
        )}
        {query.hata === "silinemedi" && (
          <InlineAlert tone="danger">Ürün silinemedi. Lütfen tekrar deneyin.</InlineAlert>
        )}

        {!canHardDelete && (
          <InlineAlert tone="info">
            Bu ürün {orderReferences} sipariş satırında geçiyor. Sipariş geçmişini
            korumak için kalıcı silme kapalıdır — kataloğdan çıkarmak için arşivleyin.
          </InlineAlert>
        )}
      </div>

      <ProductForm product={product} categories={categories} />
    </>
  )
}
