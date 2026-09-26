import type { Metadata } from "next"
import { adminPageContext } from "@/lib/admin/auth"
import { logQueryError } from "@/lib/admin/errors"
import { PageHeader, Panel } from "@/components/admin/ui/surfaces"
import { AdminOrderForm, type CatalogueProduct } from "./order-form"

export const metadata: Metadata = { title: "Yeni Sipariş" }
export const dynamic = "force-dynamic"

/**
 * Yönetici sipariş oluşturma (Feature 2 — telefon / yüz yüze siparişler).
 *
 * Fiyatlar bu ekranda yalnızca bilgilendirme amaçlı gösterilir; sipariş
 * admin_create_order içinde veritabanındaki güncel fiyat ve stokla kurulur.
 */
export default async function NewOrderPage() {
  const { supabase } = await adminPageContext("manageOrders")

  const { data, error } = await supabase
    .from("products")
    .select("id, name, is_active, product_variants(id, label, price, stock_quantity)")
    .eq("is_active", true)
    .order("name", { ascending: true })
    .limit(500)

  if (error) logQueryError("orders:yeni-catalogue", error)

  const catalogue: CatalogueProduct[] = ((data ?? []) as {
    id: string
    name: string
    is_active: boolean
    product_variants: { id: string; label: string; price: number | string; stock_quantity: number }[] | null
  }[]).map((p) => ({
    id: p.id,
    name: p.name,
    variants: (p.product_variants ?? []).map((v) => ({
      id: v.id,
      label: v.label,
      price: Number(v.price),
      stock: v.stock_quantity,
    })),
  }))

  return (
    <>
      <PageHeader
        title="Yeni sipariş"
        description="Müşteri adına telefon veya yüz yüze alınan siparişi kaydedin. Fiyatlar veritabanından alınır, stok atomik düşer."
        breadcrumbs={[
          { label: "Yönetim", href: "/admin" },
          { label: "Siparişler", href: "/admin/orders" },
          { label: "Yeni sipariş" },
        ]}
      />

      <Panel>
        <AdminOrderForm catalogue={catalogue} />
      </Panel>
    </>
  )
}
