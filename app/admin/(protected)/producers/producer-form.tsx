"use client"

import { useActionState, useCallback, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Image as ImageIcon, Trash2 } from "lucide-react"
import { saveProducerAction } from "./actions"
import { MediaPicker } from "@/components/admin/media/media-picker"
import type { MediaAsset } from "@/lib/admin/media"
import { ACTION_IDLE } from "@/lib/admin/errors"
import type { ProducerDetail } from "@/lib/admin/queries/producers"
import {
  AdminButton,
  AdminCheckbox,
  AdminInput,
  AdminSelect,
  AdminTextarea,
  FormMessage,
  SubmitButton,
} from "@/components/admin/ui/form"
import { Panel } from "@/components/admin/ui/surfaces"

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

const SOURCE_OPTIONS = [
  { value: "ciftlik", label: "Kabia Çiftliği — kendi çiftliğimiz" },
  { value: "secki", label: "Kabia Seçki — güvendiğimiz üreticiler" },
  { value: "mutfak", label: "Kabia Mutfak — geleneksel üretim" },
] as const

export function ProducerForm({ producer }: { producer: ProducerDetail | null }) {
  const [state, formAction] = useActionState(saveProducerAction, ACTION_IDLE)
  const [slugTouched, setSlugTouched] = useState(Boolean(producer))
  const [slug, setSlug] = useState(producer?.slug ?? "")
  const [photoUrl, setPhotoUrl] = useState(producer?.photoUrl ?? "")
  const [pickerOpen, setPickerOpen] = useState(false)

  const errors = state.fieldErrors ?? {}
  const isEdit = Boolean(producer)

  /**
   * A photo chosen once in /admin/media does not have to be retyped as a URL
   * on every producer that uses it. Single-select: choosing replaces.
   */
  const addFromLibrary = useCallback((assets: MediaAsset[]) => {
    const first = assets[0]
    if (first) setPhotoUrl(first.url)
  }, [])

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {producer && <input type="hidden" name="producerId" value={producer.id} />}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel title="Temel bilgiler">
            <div className="grid gap-5 sm:grid-cols-2">
              <AdminInput
                label="Üretici adı"
                name="name"
                required
                defaultValue={producer?.name ?? ""}
                error={errors.name}
                wrapperClassName="sm:col-span-2"
                onChange={(event) => {
                  if (slugTouched) return
                  setSlug(slugify(event.target.value))
                }}
              />

              <AdminInput
                label="Kısa ad (URL)"
                name="slug"
                required
                value={slug}
                onChange={(event) => {
                  setSlugTouched(true)
                  setSlug(slugify(event.target.value))
                }}
                error={errors.slug}
                hint="Mağaza ve hikâye adresi: /magaza/kısa-ad, /ureticiler/kısa-ad"
              />

              <AdminSelect
                label="Kaynak"
                name="source"
                required
                defaultValue={producer?.source ?? ""}
                error={errors.source}
                hint="Hangi hatta ait olduğu /secki üyeliğini belirler."
              >
                <option value="" disabled>
                  Kaynak seçin
                </option>
                {SOURCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </AdminSelect>

              <AdminInput
                label="Tek satırlık tanıtım"
                name="desc"
                required
                defaultValue={producer?.desc ?? ""}
                error={errors.desc}
                wrapperClassName="sm:col-span-2"
                hint="/secki kartında adın altında görünür."
              />

              <AdminInput
                label="Bölge"
                name="region"
                defaultValue={producer?.region ?? ""}
                error={errors.region}
              />

              <AdminInput
                label="Ürün türü"
                name="product_type"
                defaultValue={producer?.productType ?? ""}
                error={errors.product_type}
                hint="Örn. Fındık, Bal, Salça"
              />

              <AdminInput
                label="Sıra"
                name="sort_order"
                inputMode="numeric"
                defaultValue={String(producer?.sortOrder ?? 0)}
                error={errors.sort_order}
                hint="Küçük sayı önce gelir. /ureticiler ve /secki bu sırayı kullanır."
              />
            </div>
          </Panel>

          <Panel
            title="Fotoğraf"
            description="Medya kütüphanesinden seçilir — bu ekrana dosya yüklenmez."
          >
            <input type="hidden" name="photo_url" value={photoUrl} />

            <div className="mb-5 flex flex-wrap items-center gap-2">
              <AdminButton variant="primary" onClick={() => setPickerOpen(true)}>
                <ImageIcon className="h-4 w-4" aria-hidden="true" />
                Medyadan seç
              </AdminButton>
              {photoUrl && (
                <AdminButton variant="ghost" onClick={() => setPhotoUrl("")}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Kaldır
                </AdminButton>
              )}
            </div>

            <MediaPicker
              open={pickerOpen}
              onClose={() => setPickerOpen(false)}
              onConfirm={addFromLibrary}
              multiple={false}
            />

            {photoUrl ? (
              <span className="relative block aspect-[16/9] w-full max-w-md overflow-hidden rounded-media bg-ink/[0.06]">
                <Image
                  src={photoUrl}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 28rem, 100vw"
                  className="object-cover"
                  unoptimized
                />
              </span>
            ) : (
              <p className="py-6 text-center text-sm text-ink/45">
                Henüz fotoğraf seçilmedi.
              </p>
            )}
            {errors.photo_url && (
              <p role="alert" className="mt-2 text-xs text-clay">
                {errors.photo_url}
              </p>
            )}
          </Panel>

          <Panel
            title="Hikâye"
            description="Boş satırla ayrılan her blok mağazada ayrı paragraf olur."
          >
            <AdminTextarea
              label="Hikâye"
              name="story"
              rows={10}
              defaultValue={producer?.story ?? ""}
              error={errors.story}
              hint="Paragrafları boş bir satırla ayırın. Tek satır sonları birleşir."
            />
          </Panel>

          <Panel title="Üretim bilgileri" description="Boş bırakılan alanlar mağazada gösterilmez.">
            <div className="grid gap-5 sm:grid-cols-2">
              <AdminInput
                label="Üretim yeri"
                name="production_place"
                defaultValue={producer?.productionPlace ?? ""}
                error={errors.production_place}
                wrapperClassName="sm:col-span-2"
              />
              <AdminTextarea
                label="Yöntem"
                name="method"
                rows={3}
                defaultValue={producer?.method ?? ""}
                error={errors.method}
                wrapperClassName="sm:col-span-2"
              />
              <AdminTextarea
                label="Girdiler"
                name="inputs"
                rows={3}
                defaultValue={producer?.inputs ?? ""}
                error={errors.inputs}
                wrapperClassName="sm:col-span-2"
              />
              <AdminTextarea
                label="Belgeler"
                name="certificates"
                rows={2}
                defaultValue={producer?.certificates ?? ""}
                error={errors.certificates}
                wrapperClassName="sm:col-span-2"
              />
              <AdminTextarea
                label="Neden Kabia'nın üreticisi"
                name="why_selected"
                rows={3}
                defaultValue={producer?.whySelected ?? ""}
                error={errors.why_selected}
                wrapperClassName="sm:col-span-2"
              />
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Yayın">
            <AdminCheckbox
              label="Mağazada yayında"
              name="is_published"
              defaultChecked={producer ? producer.isPublished : true}
              hint="Kapatıldığında üretici /ureticiler ve /secki listelerinden kalkar, ürünleri korunur."
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
              href="/admin/producers"
              prefetch={false}
              className="inline-flex min-h-11 items-center rounded-full px-4 text-sm text-ink/60 transition-colors duration-300 hover:text-ink"
            >
              İptal
            </Link>
            <SubmitButton pendingLabel="Kaydediliyor…">
              {isEdit ? "Değişiklikleri kaydet" : "Üreticiyi oluştur"}
            </SubmitButton>
          </div>
        </div>
      </div>
    </form>
  )
}
