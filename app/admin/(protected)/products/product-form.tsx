"use client"

import { useActionState, useState } from "react"
import Link from "next/link"
import { Plus, Trash2 } from "lucide-react"
import { saveProductAction } from "./actions"
import { GalleryEditor } from "@/components/admin/media/gallery-editor"
import { galleryFromRows, toPayload, type GalleryState } from "@/lib/admin/gallery"
import { ACTION_IDLE } from "@/lib/admin/errors"
import type { ProductDetail } from "@/lib/admin/queries/products"
import type { CategoryOption, ProducerOption } from "@/lib/admin/queries/products"
import {
  CERTIFICATION_LABEL,
  PRODUCT_CERTIFICATIONS,
  SOURCES,
  type ProductCertification,
} from "@/lib/products"
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
 * field names (`variants[0][price]`) are fragile to reorder. The gallery is
 * edited through the shared GalleryEditor (lib/admin/gallery.ts holds its
 * rules); the main image and the gallery are submitted together and saved in
 * one transaction.
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

function toGallery(product: ProductDetail | null): GalleryState {
  if (!product) return { items: [], mainUrl: "" }
  return galleryFromRows(product.images, product.mainImageUrl ?? "")
}

export function ProductForm({
  product,
  categories,
  producers,
}: {
  product: ProductDetail | null
  categories: CategoryOption[]
  producers: ProducerOption[]
}) {
  const [state, formAction] = useActionState(saveProductAction, ACTION_IDLE)
  const [variants, setVariants] = useState<VariantDraft[]>(() => toVariantDrafts(product))
  const [gallery, setGallery] = useState<GalleryState>(() => toGallery(product))
  // Tracked so an image added from the library can be given the product's name
  // as its alt text when the library has none for it.
  const [productName, setProductName] = useState(product?.name ?? "")
  const [slugTouched, setSlugTouched] = useState(Boolean(product))
  const [slug, setSlug] = useState(product?.slug ?? "")
  // Certification drives a confirmation step, so the form has to know the
  // current choice rather than leaving it entirely to the DOM.
  const [certification, setCertification] = useState<ProductCertification | "">(
    product?.certification ?? "",
  )
  // Confirmation is asked when the organic claim is *made*, matching the server
  // rule in lib/admin/product-fields.ts — not on every save of a product that
  // already holds a certificate.
  const needsOrganicConfirmation =
    certification === "organik_sertifikali" &&
    product?.certification !== "organik_sertifikali"

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

  const galleryPayload = toPayload(gallery)

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {product && <input type="hidden" name="productId" value={product.id} />}
      <input type="hidden" name="variants" value={variantsPayload} />
      <input type="hidden" name="images" value={JSON.stringify(galleryPayload.images)} />
      <input type="hidden" name="main_image_url" value={galleryPayload.main_image_url} />

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
                  setProductName(event.target.value)
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

          <Panel
            title="Görseller"
            description="Görselleri medya kütüphanesinden seçin ya da yükleyin. Ana görsel mağaza kartında görünür; galeri sırası ürün sayfasındaki sırayı izler."
          >
            <GalleryEditor
              state={gallery}
              onChange={setGallery}
              fallbackAlt={productName.trim()}
              folder="products"
              mainLabel="Ana görsel"
              requireMain
              error={errors.main_image_url ?? errors.images}
              emptyText="Henüz görsel eklenmedi. Ürünün en az bir görseli olmalı — Medyadan seçin ya da yeni bir dosya yükleyin."
            />
          </Panel>

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

          <Panel
            title="Kaynak ve üretici"
            description="Mağazada ürünün altında görünen satır ve /magaza kaynak filtresi buradan gelir."
          >
            <div className="space-y-5">
              <AdminSelect
                label="Kaynak"
                name="source"
                required
                defaultValue={product?.source ?? ""}
                error={errors.source}
                hint="Ürün Kabia'nın hangi hattına ait: kendi çiftliğimiz, seçtiğimiz üretici ya da üreticinin mutfağı."
              >
                <option value="" disabled>
                  Kaynak seçin
                </option>
                {SOURCES.filter((entry) => entry.id !== "tumu").map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.badgeLabel}
                  </option>
                ))}
              </AdminSelect>

              <div>
                <AdminSelect
                  label="Üretici"
                  name="producer_id"
                  defaultValue={product?.producerId ?? ""}
                  error={errors.producer_id}
                  hint="Seçki ve Mutfak ürünleri için. Ürün sayfasındaki üretici satırını ve /magaza/[üretici] listesini belirler."
                >
                  <option value="">Üretici yok</option>
                  {producers.map((producer) => (
                    <option key={producer.id} value={producer.id}>
                      {producer.name}
                      {producer.isPublished ? "" : " (yayında değil)"}
                    </option>
                  ))}
                </AdminSelect>
                <div className="mt-1.5 flex justify-end">
                  <Link
                    href="/admin/producers"
                    prefetch={false}
                    className="text-xs text-brand transition-colors duration-300 hover:text-forest"
                  >
                    Üreticileri yönet →
                  </Link>
                </div>
              </div>

              <AdminSelect
                label="Sertifika"
                name="certification"
                required
                value={certification}
                onChange={(event) =>
                  setCertification(event.target.value as ProductCertification | "")
                }
                error={errors.certification}
                hint="“Organik Sertifikalı” yalnızca gerçek bir organik sertifika varsa seçilir; diğer ikisi Kabia'nın kendi seçme yaklaşımını ifade eder."
              >
                <option value="" disabled>
                  Sertifika seçin
                </option>
                {PRODUCT_CERTIFICATIONS.map((value) => (
                  <option key={value} value={value}>
                    {CERTIFICATION_LABEL[value]}
                  </option>
                ))}
              </AdminSelect>

              {needsOrganicConfirmation && (
                <AdminCheckbox
                  name="organic_confirmed"
                  label="Bu ürün için gerçek bir organik sertifika bulunduğunu onaylıyorum."
                  hint="Organik sertifikalı etiketi yasal bir iddiadır. Onaylanmadan kaydedilmez."
                />
              )}
            </div>
          </Panel>

          <Panel title="Üretim bilgileri">
            <div className="space-y-5">
              <AdminInput label="Menşei" name="origin" defaultValue={product?.origin ?? ""} />
              <AdminInput label="Üretim yöntemi" name="production_method" defaultValue={product?.productionMethod ?? ""} />
              <AdminInput label="İşleme" name="processing" defaultValue={product?.processing ?? ""} error={errors.processing} />
              <AdminInput label="Çeşit" name="variety" defaultValue={product?.variety ?? ""} error={errors.variety} />
              <AdminInput label="Anaç" name="rootstock" defaultValue={product?.rootstock ?? ""} error={errors.rootstock} />
              <AdminInput
                label="Hasat yılı"
                name="harvest_year"
                inputMode="numeric"
                defaultValue={product?.harvestYear != null ? String(product.harvestYear) : ""}
                error={errors.harvest_year}
              />
              <AdminInput label="Lot kodu" name="lot_code" defaultValue={product?.lotCode ?? ""} error={errors.lot_code} />
              <AdminInput label="Net ağırlık" name="net_weight" defaultValue={product?.netWeight ?? ""} error={errors.net_weight} hint="Ambalajda yazan net miktar. Seçenek adından ayrıdır." />
              <AdminInput label="Alerjenler" name="allergens" defaultValue={product?.allergens ?? ""} error={errors.allergens} />
              <AdminInput label="Raf ömrü" name="shelf_life" defaultValue={product?.shelfLife ?? ""} />
              <AdminInput label="Saklama koşulları" name="storage_conditions" defaultValue={product?.storageConditions ?? ""} />
              <AdminInput label="Sertifikalar" name="certifications" defaultValue={product?.certifications ?? ""} hint="Serbest metin not. Yasal sertifika iddiası için yukarıdaki Sertifika alanı kullanılır." />
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
