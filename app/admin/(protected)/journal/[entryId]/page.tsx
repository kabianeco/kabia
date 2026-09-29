import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { adminPageContext } from "@/lib/admin/auth"
import { loadJournalDetail } from "@/lib/admin/queries/journal"
import { formatDate, formatDateTime } from "@/lib/admin/format"
import { InlineAlert, PageHeader } from "@/components/admin/ui/surfaces"
import { ConfirmAction } from "@/components/admin/ui/confirm-dialog"
import { PublishTag } from "@/components/admin/ui/status"
import { JournalForm } from "../journal-form"
import { deleteJournalEntryAction, toggleJournalPublishedAction } from "../actions"

export const metadata: Metadata = { title: "Günlük Notunu Düzenle" }
export const dynamic = "force-dynamic"

export default async function EditJournalEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ entryId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { supabase } = await adminPageContext("manageJournal")
  const { entryId } = await params
  const query = await searchParams

  const entry = await loadJournalDetail(supabase, entryId)
  if (!entry) notFound()

  return (
    <>
      <PageHeader
        title={formatDate(entry.entryDate)}
        description={`Son güncelleme: ${formatDateTime(entry.updatedAt)}`}
        breadcrumbs={[
          { label: "Yönetim", href: "/admin" },
          { label: "Günlük", href: "/admin/journal" },
          { label: formatDate(entry.entryDate) },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PublishTag active={entry.isPublished} />

            {entry.isPublished && (
              <Link
                href={`/gunluk/${entry.slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center rounded-full border border-ink/20 px-4 text-sm text-ink transition-colors duration-300 hover:border-brand hover:text-brand"
              >
                Sayfayı gör
              </Link>
            )}

            <ConfirmAction
              trigger={entry.isPublished ? "Yayından kaldır" : "Yayına al"}
              triggerVariant="outline"
              tone={entry.isPublished ? "danger" : "primary"}
              title={entry.isPublished ? "Notu yayından kaldır" : "Notu yayına al"}
              description={
                entry.isPublished
                  ? "Not /gunluk listesinden, sitemap'ten ve rehberden kalkar; adresi 404 döner. Kayıt korunur."
                  : "Not /gunluk sayfasında görünmeye başlar."
              }
              entityName={entry.slug}
              confirmLabel={entry.isPublished ? "Yayından kaldır" : "Yayına al"}
              pendingLabel="İşleniyor…"
              action={toggleJournalPublishedAction}
              hiddenFields={{ entryId: entry.id }}
            />

            {!entry.isPublished && (
              <ConfirmAction
                trigger="Kalıcı sil"
                triggerVariant="danger"
                title="Notu kalıcı olarak sil"
                description="Bu işlem geri alınamaz. Not ve görsel listesi silinir; görseller medya kütüphanesinde kalır. Onaylamak için notun kısa adını yazın."
                entityName={entry.slug}
                typedConfirmation={entry.slug}
                confirmLabel="Kalıcı olarak sil"
                pendingLabel="Siliniyor…"
                action={deleteJournalEntryAction}
                hiddenFields={{ entryId: entry.id }}
              />
            )}
          </div>
        }
      />

      <div className="mb-6 space-y-3">
        {query.kayit === "1" && <InlineAlert tone="success">Günlük notu kaydedildi ve sayfaya yansıtıldı.</InlineAlert>}
        {query.yayin === "1" && <InlineAlert tone="success">Yayın durumu güncellendi.</InlineAlert>}
        {query.hata === "gorsel" && (
          <InlineAlert tone="danger">
            Not oluşturuldu ancak görselleri kaydedilemedi. Görselleri aşağıdan yeniden ekleyip kaydedin.
          </InlineAlert>
        )}
        {query.hata === "yayinda" && (
          <InlineAlert tone="danger">Yayındaki not silinemez. Önce yayından kaldırın, sonra silin.</InlineAlert>
        )}
        {query.hata === "silinemedi" && <InlineAlert tone="danger">Not silinemedi. Lütfen tekrar deneyin.</InlineAlert>}
        {entry.isPublished && (
          <InlineAlert tone="info">
            Bu not yayında olduğu için silinemez. Silmek için önce yayından kaldırın; kısa ad (adres) hiçbir zaman değişmez.
          </InlineAlert>
        )}
      </div>

      <JournalForm entry={entry} />
    </>
  )
}
