import type { Metadata } from "next"
import { adminPageContext } from "@/lib/admin/auth"
import { PageHeader } from "@/components/admin/ui/surfaces"
import { JournalForm } from "../journal-form"

export const metadata: Metadata = { title: "Yeni Günlük Notu" }
export const dynamic = "force-dynamic"

export default async function NewJournalEntryPage() {
  await adminPageContext("manageJournal")

  return (
    <>
      <PageHeader
        title="Not ekle"
        description="Not yayında işaretliyse kaydedildiği anda /gunluk sayfasında görünür."
        breadcrumbs={[
          { label: "Yönetim", href: "/admin" },
          { label: "Günlük", href: "/admin/journal" },
          { label: "Yeni" },
        ]}
      />
      <JournalForm entry={null} />
    </>
  )
}
