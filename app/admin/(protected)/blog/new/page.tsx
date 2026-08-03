import type { Metadata } from "next"
import { adminPageContext } from "@/lib/admin/auth"
import { fetchAdminCategories, fetchAdminTags } from "@/lib/blog/queries"
import { PageHeader } from "@/components/admin/ui/surfaces"
import { PostForm } from "../post-form"

export const metadata: Metadata = { title: "Yeni Yazı" }
export const dynamic = "force-dynamic"

export default async function NewBlogPostPage() {
  const { supabase } = await adminPageContext("manageBlog")
  const [categories, tags] = await Promise.all([fetchAdminCategories(supabase), fetchAdminTags(supabase)])

  return (
    <>
      <PageHeader
        title="Yazı ekle"
        description="Yazı kaydedildiğinde taslak olarak oluşturulur. Mağazada görünmesi için yayınlamanız gerekir."
        breadcrumbs={[{ label: "Yönetim", href: "/admin" }, { label: "Blog", href: "/admin/blog" }, { label: "Yeni" }]}
      />
      <PostForm post={null} categories={categories} tags={tags} />
    </>
  )
}
