import type { Metadata } from "next"
import { adminPageContext } from "@/lib/admin/auth"
import { PageHeader } from "@/components/admin/ui/surfaces"
import { ProducerForm } from "../producer-form"

export const metadata: Metadata = { title: "Yeni Üretici" }
export const dynamic = "force-dynamic"

export default async function NewProducerPage() {
  await adminPageContext("manageProducers")

  return (
    <>
      <PageHeader
        title="Üretici ekle"
        description="Üretici oluşturulduğunda, yayında işaretliyse listelerde hemen görünür."
        breadcrumbs={[
          { label: "Yönetim", href: "/admin" },
          { label: "Üreticiler", href: "/admin/producers" },
          { label: "Yeni" },
        ]}
      />
      <ProducerForm producer={null} />
    </>
  )
}
