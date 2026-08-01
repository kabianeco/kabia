import type { Metadata } from "next"
import Link from "next/link"
import { adminContext } from "@/lib/admin/auth"
import { loadCategoriesWithCount } from "@/lib/admin/queries/categories"
import { PageHeader, Panel } from "@/components/admin/ui/surfaces"
import { Table, TableScroll, Td, Th, Tr } from "@/components/admin/ui/table"
import { CategoryForm, CategoryRowActions } from "./category-form"

export const metadata: Metadata = { title: "Kategoriler" }
export const dynamic = "force-dynamic"

export default async function CategoriesPage() {
  const { supabase } = await adminContext("manageCategories")
  const categories = await loadCategoriesWithCount(supabase)

  return (
    <>
      <PageHeader
        title="Kategoriler"
        description="Ürün kategorilerini yönetin. Kategoriler mağaza menüsünde ve ürün düzenleyicide kullanılır."
        breadcrumbs={[{ label: "Yönetim", href: "/admin" }, { label: "Kategoriler" }]}
      />

      <div className="space-y-6">
        <Panel title="Yeni kategori" description="Kategori adı girildiğinde kısa ad otomatik oluşur.">
          <CategoryForm />
        </Panel>

        <Panel title="Tüm kategoriler" bodyClassName="px-0 py-0 md:px-0">
          <div className="px-4 py-4 md:px-5">
            <TableScroll>
              <Table caption="Kategori listesi">
                <thead>
                  <tr>
                    <Th>Kategori</Th>
                    <Th>Kısa ad (URL)</Th>
                    <Th align="right">Ürün</Th>
                    <Th align="right">
                      <span className="sr-only">İşlemler</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category) => (
                    <Tr key={category.id}>
                      <Td>
                        <span className="font-medium text-ink">{category.name}</span>
                      </Td>
                      <Td>
                        <span className="text-sm text-ink/60">/{category.slug}</span>
                      </Td>
                      <Td align="right" numeric>
                        {category.productCount}
                      </Td>
                      <Td align="right">
                        <CategoryRowActions
                          categoryId={category.id}
                          name={category.name}
                          slug={category.slug}
                          productCount={category.productCount}
                        />
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableScroll>

            {categories.length === 0 && (
              <p className="py-8 text-center text-sm text-ink/45">
                Henüz kategori yok. Yeni kategori ekleyerek başlayın.
              </p>
            )}
          </div>
        </Panel>

        <p className="text-xs text-ink/45">
          Kategoriye bağlı ürün olduğunda silme işlemi engellenir. Önce ürünleri başka bir kategoriye
          taşıyın veya arşivleyin. Kısa adres değiştiğinde mağaza bağlantıları da değişir; eski
          adresler otomatik yönlendirilmez.
        </p>
      </div>
    </>
  )
}
