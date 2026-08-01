import type { Metadata } from "next"
import { adminContext } from "@/lib/admin/auth"
import { loadCategories } from "@/lib/admin/queries/products"
import { PageHeader } from "@/components/admin/ui/surfaces"
import { ProductForm } from "../product-form"

export const metadata: Metadata = { title: "Yeni Ürün" }
export const dynamic = "force-dynamic"

export default async function NewProductPage() {
  const { supabase } = await adminContext("manageCatalogue")
  const categories = await loadCategories(supabase)

  return (
    <>
      <PageHeader
        title="Ürün ekle"
        description="Ürün oluşturulduğunda, yayında işaretliyse mağazada hemen görünür."
        breadcrumbs={[
          { label: "Yönetim", href: "/admin" },
          { label: "Ürünler", href: "/admin/products" },
          { label: "Yeni" },
        ]}
      />
      <ProductForm product={null} categories={categories} />
    </>
  )
}
