"use client"

import { useActionState, useState } from "react"
import Link from "next/link"
import { saveJournalEntryAction } from "./actions"
import { GalleryEditor } from "@/components/admin/media/gallery-editor"
import { toPayload, type GalleryState } from "@/lib/admin/gallery"
import { ACTION_IDLE } from "@/lib/admin/errors"
import type { JournalDetail } from "@/lib/admin/queries/journal"
import {
  AdminCheckbox,
  AdminInput,
  AdminTextarea,
  FormMessage,
  SubmitButton,
} from "@/components/admin/ui/form"
import { Panel } from "@/components/admin/ui/surfaces"

/**
 * Journal entry editor.
 *
 * The gallery is edited through the shared GalleryEditor and submitted, with its
 * cover, as two hidden fields; the server saves them together in one
 * transaction. The slug is the entry's public URL: it is suggested from the date
 * and the observation while creating, and read-only afterwards.
 */

function slugify(value: string): string {
  return value
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/** The date-and-place label the public page uses as an image's alt text. */
function altFallback(date: string, location: string): string {
  const parsed = new Date(date)
  const formatted = Number.isNaN(parsed.getTime())
    ? ""
    : parsed.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })
  return [formatted, location.trim()].filter(Boolean).join(" — ")
}

function suggestSlug(date: string, observation: string): string {
  const words = slugify(observation).split("-").filter(Boolean).slice(0, 4).join("-")
  return [/^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "", words].filter(Boolean).join("-")
}

export function JournalForm({ entry }: { entry: JournalDetail | null }) {
  const [state, formAction] = useActionState(saveJournalEntryAction, ACTION_IDLE)
  const isEdit = Boolean(entry)
  const [gallery, setGallery] = useState<GalleryState>(entry?.gallery ?? { items: [], mainUrl: "" })
  const [slug, setSlug] = useState(entry?.slug ?? "")
  const [slugTouched, setSlugTouched] = useState(isEdit)
  const [date, setDate] = useState(entry?.entryDate ?? "")
  const [location, setLocation] = useState(entry?.location ?? "Kabia Çiftliği")
  const [observation, setObservation] = useState(entry?.observation ?? "")

  const errors = state.fieldErrors ?? {}
  const payload = toPayload(gallery)

  const suggest = (nextDate: string, nextObservation: string) => {
    if (!slugTouched) setSlug(suggestSlug(nextDate, nextObservation))
  }

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {entry && <input type="hidden" name="entryId" value={entry.id} />}
      <input type="hidden" name="images" value={JSON.stringify(payload.images)} />
      <input type="hidden" name="main_image_url" value={payload.main_image_url} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel title="Not">
            <div className="grid gap-5 sm:grid-cols-2">
              <AdminInput
                label="Tarih"
                name="entry_date"
                type="date"
                required
                value={date}
                error={errors.entry_date}
                onChange={(event) => {
                  setDate(event.target.value)
                  suggest(event.target.value, observation)
                }}
              />

              <AdminInput
                label="Konum"
                name="location"
                required
                value={location}
                maxLength={120}
                error={errors.location}
                onChange={(event) => setLocation(event.target.value)}
              />

              <AdminInput
                label="Kısa ad (URL)"
                name="slug"
                required
                value={slug}
                readOnly={isEdit}
                error={errors.slug}
                wrapperClassName="sm:col-span-2"
                hint={
                  isEdit
                    ? "Yayınlanan adres değişmez: /gunluk/" + (entry?.slug ?? "")
                    : "Sayfa adresi: /gunluk/kısa-ad. Kaydedildikten sonra değiştirilemez."
                }
                onChange={(event) => {
                  setSlugTouched(true)
                  setSlug(slugify(event.target.value))
                }}
              />

              <AdminInput
                label="Hava"
                name="weather"
                required
                defaultValue={entry?.weather ?? ""}
                maxLength={120}
                error={errors.weather}
                hint="Örn. Açık 18°"
              />

              <AdminInput
                label="Uygulama"
                name="application"
                required
                defaultValue={entry?.application ?? ""}
                maxLength={400}
                error={errors.application}
                hint="Yapılmadıysa: Yok — sadece gözlem"
              />

              <AdminInput
                label="Bahçenin durumu"
                name="orchard_state"
                required
                defaultValue={entry?.orchardState ?? ""}
                maxLength={300}
                error={errors.orchard_state}
                wrapperClassName="sm:col-span-2"
              />
            </div>
          </Panel>

          <Panel title="Gözlem ve sonuç" description="Gözlem sayfanın başlığı ve liste satırıdır; ilk cümlesi arama sonucunda başlık olur.">
            <div className="space-y-5">
              <AdminTextarea
                label="Gözlem"
                name="observation"
                required
                rows={3}
                maxLength={600}
                value={observation}
                error={errors.observation}
                onChange={(event) => {
                  setObservation(event.target.value)
                  suggest(date, event.target.value)
                }}
              />
              <AdminTextarea
                label="Sonuç"
                name="outcome"
                required
                rows={4}
                maxLength={1000}
                defaultValue={entry?.outcome ?? ""}
                error={errors.outcome}
              />
            </div>
          </Panel>

          <Panel
            title="Görseller"
            description="İlk seçilen görsel kapak olur. Kapak listede ve not sayfasının başında görünür; diğer görseller sırayla altında gösterilir."
          >
            <GalleryEditor
              state={gallery}
              onChange={setGallery}
              fallbackAlt={altFallback(date, location)}
              folder="journal"
              mainLabel="Kapak"
              requireMain={false}
              error={errors.main_image_url ?? errors.images}
              emptyText="Bu notun görseli yok. İsterseniz Medyadan seçin ya da yeni bir dosya yükleyin."
            />
          </Panel>

          <Panel
            title="Video"
            description="İsteğe bağlı. Video medya kütüphanesine yüklenmez; dosya projenin public klasöründe durur."
          >
            <AdminInput
              label="Video yolu"
              name="video_path"
              defaultValue={entry?.videoPath ?? ""}
              maxLength={300}
              error={errors.video_path}
              hint="Örn. /images/gunluk-2026-03-15-kaolin.mp4 — yeni bir video için dosyanın koda eklenip dağıtılması gerekir."
            />
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Yayın">
            <AdminCheckbox
              label="Sitede yayında"
              name="is_published"
              defaultChecked={entry ? entry.isPublished : true}
              hint="Kapatıldığında not /gunluk listesinden, sitemap'ten ve rehberden kalkar."
            />
          </Panel>
        </div>
      </div>

      <div className="sticky bottom-0 -mx-4 border-t border-ink/10 bg-ivory/95 px-4 py-4 backdrop-blur-sm md:-mx-8 md:px-8">
        <div className="mx-auto flex max-w-[80rem] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <FormMessage state={state} />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/admin/journal"
              prefetch={false}
              className="inline-flex min-h-11 items-center rounded-full px-4 text-sm text-ink/60 transition-colors duration-300 hover:text-ink"
            >
              İptal
            </Link>
            <SubmitButton pendingLabel="Kaydediliyor…">{isEdit ? "Değişiklikleri kaydet" : "Notu oluştur"}</SubmitButton>
          </div>
        </div>
      </div>
    </form>
  )
}
