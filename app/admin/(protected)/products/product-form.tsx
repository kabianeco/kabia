"use client"

import { useActionState, useEffect, useId, useRef, useState, useTransition } from "react"
import Image from "next/image"
import Link from "next/link"
import { GripVertical, Plus, Trash2, Upload } from "lucide-react"
import { saveProductAction } from "./actions"
import { uploadMediaAction } from "../media/actions"
import { ACTION_IDLE } from "@/lib/admin/errors"
import type { ProductDetail } from "@/lib/admin/queries/products"
import type { CategoryOption } from "@/lib/admin/queries/products"
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

/**
 * Product editor.
 *
 * Variants and images are edited as arrays in React state and submitted as JSON
 * in hidden fields, because FormData has no natural array shape and indexed
 * field names (`variants[0][price]`) are fragile to reorder.
 *
 * Stock is intentionally read-only for existing variants. Moving stock is an
 * audited operation with a mandatory reason, and it lives on the inventory
 * screen — letting it be edited here as an incidental side effect of renaming a
 * product would put unexplained movements into the history. New variants set an
 * opening quantity, which is the one case where there is nothing to explain.
 */

interface VariantDraft {
  key: string
  id: string | null
  label: string
  price: string
  stock_quantity: string
  sku: string
}

interface ImageDraft {
  key: string
  id: string | null
  image_url: string
  alt_text: string
  storage_path: string | null
}

function toVariantDrafts(product: ProductDetail | null): VariantDraft[] {
  if (!product || product.variants.length === 0) {
    return [{ key: crypto.randomUUID(), id: null, label: "", price: "", stock_quantity: "0", sku: "" }]
  }
  return product.variants.map((variant) => ({
    key: variant.id,
    id: variant.id,
    label: variant.label,
    price: String(variant.price),
    stock_quantity: String(variant.stockQuantity),
    sku: variant.sku ?? "",
  }))
}

function toImageDrafts(product: ProductDetail | null): ImageDraft[] {
  if (!product) return []
  return product.images.map((image) => ({
    key: image.id,
    id: image.id,
    image_url: image.imageUrl,
    alt_text: image.altText ?? "",
    storage_path: image.storagePath,
  }))
}

export function ProductForm({
  product,
  categories,
}: {
  product: ProductDetail | null
  categories: CategoryOption[]
}) {
  const [state, formAction] = useActionState(saveProductAction, ACTION_IDLE)
  const [variants, setVariants] = useState<VariantDraft[]>(() => toVariantDrafts(product))
  const [images, setImages] = useState<ImageDraft[]>(() => toImageDrafts(product))
  const [mainImageUrl, setMainImageUrl] = useState(product?.mainImageUrl ?? "")
  const [slugTouched, setSlugTouched] = useState(Boolean(product))
  const [slug, setSlug] = useState(product?.slug ?? "")

  const errors = state.fieldErrors ?? {}
  const isEdit = Boolean(product)

  const variantsPayload = JSON.stringify(
    variants.map((variant) => ({
      id: variant.id,
      label: variant.label.trim(),
      price: variant.price,
      stock_quantity: variant.stock_quantity === "" ? 0 : Number(variant.stock_quantity),
      sku: variant.sku.trim(),
    })),
  )

  const imagesPayload = JSON.stringify(
    images.map((image, index) => ({
      id: image.id,
      image_url: image.image_url.trim(),
      alt_text: image.alt_text.trim(),
      sort_order: index,
      storage_path: image.storage_path,
    })),
  )

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {product && <input type="hidden" name="productId" value={product.id} />}
      <input type="hidden" name="variants" value={variantsPayload} />
      <input type="hidden" name="images" value={imagesPayload} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel title="Temel bilgiler">
            <div className="grid gap-5 sm:grid-cols-2">
              <AdminInput
                label="Ürün adı"
                name="name"
                required
                defaultValue={product?.name ?? ""}
                error={errors.name}
                wrapperClassName="sm:col-span-2"
                onChange={(event) => {
                  if (slugTouched) return
                  const next = event.target.value
                    .toLocaleLowerCase("tr")
                    .replace(/ı/g, "i")
                    .replace(/ğ/g, "g")
                    .replace(/ü/g, "u")
                    .replace(/ş/g, "s")
                    .replace(/ö/g, "o")
                    .replace(/ç/g, "c")
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-+|-+$/g, "")
                  setSlug(next)
                }}
              />

              <AdminInput
                label="Kısa ad (URL)"
                name="slug"
                required
                value={slug}
                onChange={(event) => {
                  setSlugTouched(true)
                  setSlug(event.target.value)
                }}
                error={errors.slug}
                hint="Mağazadaki adres: /shop/kısa-ad"
              />

              <div>
                <AdminSelect
                  label="Kategori"
                  name="category_id"
                  required
                  defaultValue={product?.categoryId ?? ""}
                  error={errors.category_id}
                >
                  <option value="" disabled>
                    Kategori seçin
                  </option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </AdminSelect>
                <div className="mt-1.5 flex justify-end">
                  <Link
                    href="/admin/categories"
                    prefetch={false}
                    className="text-xs text-brand transition-colors duration-300 hover:text-forest"
                  >
                    Yeni kategori ekle →
                  </Link>
                </div>
              </div>

              <AdminTextarea
                label="Kısa açıklama"
                name="short_description"
                required
                rows={2}
                defaultValue={product?.shortDescription ?? ""}
                error={errors.short_description}
                wrapperClassName="sm:col-span-2"
              />

              <AdminTextarea
                label="Açıklama"
                name="description"
                required
                rows={6}
                defaultValue={product?.description ?? ""}
                error={errors.description}
                wrapperClassName="sm:col-span-2"
              />
            </div>
          </Panel>

          <Panel
            title="Seçenekler ve fiyatlar"
            description="Her ürünün en az bir seçeneği olmalı. Temel fiyat, seçeneklerden biriyle eşleşmeli."
            actions={
              <AdminButton
                variant="outline"
                onClick={() =>
                  setVariants((prev) => [
                    ...prev,
                    {
                      key: crypto.randomUUID(),
                      id: null,
                      label: "",
                      price: "",
                      stock_quantity: "0",
                      sku: "",
                    },
                  ])
                }
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Seçenek ekle
              </AdminButton>
            }
          >
            {errors.variants && (
              <p role="alert" className="mb-4 text-xs text-clay">
                {errors.variants}
              </p>
            )}

            <ul className="space-y-4">
              {variants.map((variant, index) => (
                <li
                  key={variant.key}
                  className="rounded-[3px] border border-ink/10 bg-ivory/60 p-4"
                >
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <AdminInput
                      label="Seçenek adı"
                      value={variant.label}
                      placeholder="500 g"
                      error={errors[`variants.${index}.label`]}
                      onChange={(event) =>
                        setVariants((prev) =>
                          prev.map((v, i) =>
                            i === index ? { ...v, label: event.target.value } : v,
                          ),
                        )
                      }
                    />
                    <AdminInput
                      label="Fiyat (₺)"
                      inputMode="decimal"
                      value={variant.price}
                      error={errors[`variants.${index}.price`]}
                      onChange={(event) =>
                        setVariants((prev) =>
                          prev.map((v, i) =>
                            i === index ? { ...v, price: event.target.value } : v,
                          ),
                        )
                      }
                    />
                    <AdminInput
                      label="SKU"
                      value={variant.sku}
                      placeholder="Opsiyonel"
                      error={errors[`variants.${index}.sku`]}
                      onChange={(event) =>
                        setVariants((prev) =>
                          prev.map((v, i) => (i === index ? { ...v, sku: event.target.value } : v)),
                        )
                      }
                    />
                    {variant.id ? (
                      <div className="flex flex-col">
                        <span className="label mb-1.5 text-olive">Stok</span>
                        <div className="flex min-h-11 items-center gap-3">
                          <span className="figure text-sm text-ink">
                            {variant.stock_quantity}
                          </span>
                          <Link
                            href="/admin/inventory"
                            prefetch={false}
                            className="text-xs text-brand transition-colors duration-300 hover:text-forest"
                          >
                            Stok güncelle →
                          </Link>
                        </div>
                        <p className="mt-1.5 text-xs text-ink/45">
                          Stok yalnızca gerekçeli düzeltmeyle değişir.
                        </p>
                      </div>
                    ) : (
                      <AdminInput
                        label="Açılış stoğu"
                        inputMode="numeric"
                        value={variant.stock_quantity}
                        error={errors[`variants.${index}.stock_quantity`]}
                        onChange={(event) =>
                          setVariants((prev) =>
                            prev.map((v, i) =>
                              i === index ? { ...v, stock_quantity: event.target.value } : v,
                            ),
                          )
                        }
                      />
                    )}
                  </div>

                  {variants.length > 1 && (
                    <div className="mt-3 flex justify-end">
                      <AdminButton
                        variant="ghost"
                        className="text-clay hover:text-clay"
                        onClick={() =>
                          setVariants((prev) => prev.filter((_, i) => i !== index))
                        }
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        Seçeneği kaldır
                      </AdminButton>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Panel>

          <ImagesPanel
            images={images}
            setImages={setImages}
            mainImageUrl={mainImageUrl}
            setMainImageUrl={setMainImageUrl}
            error={errors.main_image_url}
          />

          <Panel title="Besin değerleri" description="Boş bırakılan alanlar mağazada gösterilmez.">
            <div className="grid gap-5 sm:grid-cols-3">
              <AdminInput label="Kalori" name="nutrition_calories" defaultValue={product?.nutrition?.calories ?? ""} />
              <AdminInput label="Protein" name="nutrition_protein" defaultValue={product?.nutrition?.protein ?? ""} />
              <AdminInput label="Karbonhidrat" name="nutrition_carbohydrates" defaultValue={product?.nutrition?.carbohydrates ?? ""} />
              <AdminInput label="Yağ" name="nutrition_fat" defaultValue={product?.nutrition?.fat ?? ""} />
              <AdminInput label="Lif" name="nutrition_fiber" defaultValue={product?.nutrition?.fiber ?? ""} />
              <AdminInput label="Sodyum" name="nutrition_sodium" defaultValue={product?.nutrition?.sodium ?? ""} />
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Yayın">
            <div className="space-y-4">
              <AdminCheckbox
                label="Mağazada yayında"
                name="is_active"
                defaultChecked={product ? product.isActive : true}
                hint="Kapatıldığında ürün mağazadan kalkar, sipariş geçmişi korunur."
              />
              <AdminCheckbox
                label="Öne çıkan ürün"
                name="is_featured"
                defaultChecked={product?.isFeatured ?? false}
                hint="Anasayfadaki seçkide gösterilir."
              />
              <AdminInput
                label="Sıra"
                name="display_order"
                inputMode="numeric"
                defaultValue={String(product?.displayOrder ?? 0)}
                error={errors.display_order}
                hint="Küçük sayı önce gelir."
              />
            </div>
          </Panel>

          <Panel title="Fiyatlandırma">
            <div className="space-y-5">
              <AdminInput
                label="Temel fiyat (₺)"
                name="base_price"
                inputMode="decimal"
                required
                defaultValue={product ? String(product.basePrice) : ""}
                error={errors.base_price}
                hint="Seçeneklerden biriyle aynı olmalı."
              />
              <AdminInput
                label="Liste fiyatı (₺)"
                name="original_price"
                inputMode="decimal"
                defaultValue={product?.originalPrice != null ? String(product.originalPrice) : ""}
                error={errors.original_price}
                hint="İndirim göstermek için; temel fiyattan yüksek olmalı."
              />
            </div>
          </Panel>

          <Panel title="Stok eşiği">
            <AdminInput
              label="Kritik stok eşiği"
              name="low_stock_threshold"
              inputMode="numeric"
              defaultValue={String(product?.lowStockThreshold ?? 5)}
              error={errors.low_stock_threshold}
              hint="Toplam stok bu değere inince uyarı verilir."
            />
          </Panel>

          <Panel title="Üretim bilgileri">
            <div className="space-y-5">
              <AdminInput label="Menşei" name="origin" defaultValue={product?.origin ?? ""} />
              <AdminInput label="Üretim yöntemi" name="production_method" defaultValue={product?.productionMethod ?? ""} />
              <AdminInput label="Raf ömrü" name="shelf_life" defaultValue={product?.shelfLife ?? ""} />
              <AdminInput label="Saklama koşulları" name="storage_conditions" defaultValue={product?.storageConditions ?? ""} />
              <AdminInput label="Sertifikalar" name="certifications" defaultValue={product?.certifications ?? ""} />
            </div>
          </Panel>

          <Panel title="SEO">
            <div className="space-y-5">
              <AdminInput
                label="SEO başlığı"
                name="seo_title"
                maxLength={70}
                defaultValue={product?.seoTitle ?? ""}
                error={errors.seo_title}
                hint="En fazla 70 karakter."
              />
              <AdminTextarea
                label="SEO açıklaması"
                name="seo_description"
                rows={3}
                maxLength={200}
                defaultValue={product?.seoDescription ?? ""}
                error={errors.seo_description}
                hint="En fazla 200 karakter."
              />
            </div>
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
              href="/admin/products"
              prefetch={false}
              className="inline-flex min-h-11 items-center rounded-full px-4 text-sm text-ink/60 transition-colors duration-300 hover:text-ink"
            >
              İptal
            </Link>
            <SubmitButton pendingLabel="Kaydediliyor…">
              {isEdit ? "Değişiklikleri kaydet" : "Ürünü oluştur"}
            </SubmitButton>
          </div>
        </div>
      </div>
    </form>
  )
}

function ImagesPanel({
  images,
  setImages,
  mainImageUrl,
  setMainImageUrl,
  error,
}: {
  images: ImageDraft[]
  setImages: React.Dispatch<React.SetStateAction<ImageDraft[]>>
  mainImageUrl: string
  setMainImageUrl: React.Dispatch<React.SetStateAction<string>>
  error?: string
}) {
  const [uploadState, uploadAction] = useActionState(uploadMediaAction, ACTION_IDLE as never)
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()
  const uploadId = useId()

  const result = uploadState as { ok: boolean; url?: string; path?: string; message?: string }

  // Append the uploaded object to the gallery once the action resolves. This
  // runs in an effect rather than during render: appending is a side effect of
  // the upload completing, and the de-duplication guard below makes a repeat
  // render harmless.
  const uploadedUrl = result.ok ? result.url : undefined
  const uploadedPath = result.ok ? (result.path ?? null) : null
  useEffect(() => {
    if (!uploadedUrl) return
    setImages((prev) =>
      prev.some((image) => image.image_url === uploadedUrl)
        ? prev
        : [
            ...prev,
            {
              key: crypto.randomUUID(),
              id: null,
              image_url: uploadedUrl,
              alt_text: "",
              storage_path: uploadedPath,
            },
          ],
    )
    setMainImageUrl((current) => current || uploadedUrl)
  }, [uploadedUrl, uploadedPath, setImages, setMainImageUrl])

  return (
    <Panel
      title="Görseller"
      description="İlk görsel ana görsel olarak kullanılır. Sıralama listedeki sırayı izler."
    >
      <input type="hidden" name="main_image_url" value={mainImageUrl} />

      <div className="mb-5 rounded-[3px] border border-dashed border-ink/20 p-4">
        <label htmlFor={uploadId} className="label mb-2 block text-olive">
          Görsel yükle
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            id={uploadId}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="block w-full max-w-xs text-sm text-ink/70 file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-full file:border file:border-ink/20 file:bg-transparent file:px-4 file:text-sm file:text-ink hover:file:border-brand hover:file:text-brand"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (!file) return
              const data = new FormData()
              data.set("file", file)
              startTransition(() => uploadAction(data))
              event.target.value = ""
            }}
          />
          {pending && (
            <span className="inline-flex items-center gap-2 text-xs text-ink/55">
              <span
                aria-hidden="true"
                className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent motion-reduce:animate-none"
              />
              Yükleniyor…
            </span>
          )}
          <Upload className="h-4 w-4 text-ink/30" aria-hidden="true" />
        </div>
        <p className="mt-2 text-xs text-ink/45">JPEG, PNG, WebP veya AVIF · en fazla 5 MB</p>
        {result.message && !result.ok && (
          <p role="alert" className="mt-2 text-xs text-clay">
            {result.message}
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="mb-4 text-xs text-clay">
          {error}
        </p>
      )}

      {images.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink/45">
          Henüz görsel eklenmedi. Bir dosya yükleyin veya aşağıdan adres ekleyin.
        </p>
      ) : (
        <ul className="space-y-3">
          {images.map((image, index) => (
            <li
              key={image.key}
              className="flex flex-wrap items-start gap-4 rounded-[3px] border border-ink/10 bg-ivory/60 p-3"
            >
              <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-media bg-ink/[0.06]">
                {image.image_url && (
                  <Image
                    src={image.image_url}
                    alt=""
                    fill
                    sizes="64px"
                    className="object-cover"
                    unoptimized
                  />
                )}
              </span>

              <div className="min-w-0 flex-1 space-y-3">
                <AdminInput
                  label="Görsel adresi"
                  value={image.image_url}
                  onChange={(event) =>
                    setImages((prev) =>
                      prev.map((img, i) =>
                        i === index ? { ...img, image_url: event.target.value } : img,
                      ),
                    )
                  }
                />
                <AdminInput
                  label="Alternatif metin"
                  value={image.alt_text}
                  hint="Görme engelli kullanıcılar ve arama motorları için kısa açıklama."
                  onChange={(event) =>
                    setImages((prev) =>
                      prev.map((img, i) =>
                        i === index ? { ...img, alt_text: event.target.value } : img,
                      ),
                    )
                  }
                />
              </div>

              <div className="flex shrink-0 flex-col gap-1">
                <AdminButton
                  variant="ghost"
                  aria-label="Yukarı taşı"
                  disabled={index === 0}
                  onClick={() =>
                    setImages((prev) => {
                      const next = [...prev]
                      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
                      return next
                    })
                  }
                >
                  <GripVertical className="h-4 w-4" aria-hidden="true" />
                  Yukarı
                </AdminButton>
                <AdminButton
                  variant="ghost"
                  onClick={() => setMainImageUrl(image.image_url)}
                  disabled={mainImageUrl === image.image_url}
                >
                  {mainImageUrl === image.image_url ? "Ana görsel" : "Ana görsel yap"}
                </AdminButton>
                <AdminButton
                  variant="ghost"
                  className="text-clay hover:text-clay"
                  onClick={() => {
                    setImages((prev) => prev.filter((_, i) => i !== index))
                    if (mainImageUrl === image.image_url) setMainImageUrl("")
                  }}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Kaldır
                </AdminButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        <AdminButton
          variant="outline"
          onClick={() =>
            setImages((prev) => [
              ...prev,
              { key: crypto.randomUUID(), id: null, image_url: "", alt_text: "", storage_path: null },
            ])
          }
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          URL ile görsel ekle
        </AdminButton>
      </div>
    </Panel>
  )
}
