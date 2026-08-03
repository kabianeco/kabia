import type { Metadata } from "next"
import { adminPageContext } from "@/lib/admin/auth"
import { fetchAdminCategoriesWithCounts, fetchAdminTags } from "@/lib/blog/queries"
import { PageHeader, Panel } from "@/components/admin/ui/surfaces"
import { Table, TableScroll, Td, Th, Tr } from "@/components/admin/ui/table"
import { CategoryForm, CategoryRowActions, TagChip, TagForm } from "./taxonomy-forms"

export const metadata: Metadata = { title: "Blog Kategorileri" }
export const dynamic = "force-dynamic"

export default async function BlogTaxonomyPage() {
  const { supabase } = await adminPageContext("manageBlog")
  const [categories, tags] = await Promise.all([fetchAdminCategoriesWithCounts(supabase), fetchAdminTags(supabase)])

  return (
    <>
      <PageHeader
        title="Kategoriler ve etiketler"
        description="Blog kategorilerini ve etiketlerini yönetin. Yalnızca yayınlanmış yazısı olan kategoriler blogda filtre olarak görünür."
        breadcrumbs={[{ label: "Yönetim", href: "/admin" }, { label: "Blog", href: "/admin/blog" }, { label: "Kategoriler" }]}
      />

      <div className="space-y-6">
        <Panel title="Yeni kategori">
          <CategoryForm />
        </Panel>

        <Panel title="Tüm kategoriler" bodyClassName="px-0 py-0 md:px-0">
          <div className="px-4 py-4 md:px-5">
            <TableScroll>
              <Table caption="Kategori listesi">
                <thead>
                  <tr>
                    <Th>Kategori</Th>
                    <Th>Kısa ad</Th>
                    <Th align="right">Yazı</Th>
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
                        {!category.isActive && <span className="ml-2 text-xs text-ink/40">Pasif</span>}
                      </Td>
                      <Td>
                        <span className="text-sm text-ink/60">/{category.slug}</span>
                      </Td>
                      <Td align="right" numeric>
                        {category.postCount}
                      </Td>
                      <Td align="right">
                        <CategoryRowActions categoryId={category.id} name={category.name} slug={category.slug} postCount={category.postCount} />
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableScroll>
            {categories.length === 0 && <p className="py-8 text-center text-sm text-ink/45">Henüz kategori yok.</p>}
          </div>
        </Panel>

        <Panel title="Etiketler" description="Yazı düzenleyicide seçilebilir etiketler.">
          <div className="space-y-4">
            <TagForm />
            <div className="flex flex-wrap gap-2">
              {tags.length === 0 && <p className="text-xs text-ink/45">Henüz etiket yok.</p>}
              {tags.map((tag) => (
                <TagChip key={tag.id} tagId={tag.id} name={tag.name} />
              ))}
            </div>
          </div>
        </Panel>
      </div>
    </>
  )
}
