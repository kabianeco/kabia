"use client"

import { useActionState, useMemo, useState } from "react"
import Link from "next/link"
import { ACTION_IDLE } from "@/lib/admin/errors"
import { formatCurrency } from "@/lib/admin/format"
import {
  ADMIN_ORDER_PAYMENT_LABELS,
  type AdminOrderPaymentMethod,
} from "@/lib/admin/schemas"
import {
  AdminInput,
  AdminSelect,
  AdminTextarea,
  FormMessage,
  SubmitButton,
} from "@/components/admin/ui/form"
import {
  createAdminOrderAction,
  lookupCustomerByNumberAction,
  type AdminOrderCreateState,
  type CustomerLookupState,
} from "./actions"

export interface CatalogueVariant {
  id: string
  label: string
  price: number
  stock: number
}

export interface CatalogueProduct {
  id: string
  name: string
  variants: CatalogueVariant[]
}

interface SavedAddress {
  id: string
  label: string
  full_name: string
  phone: string
  address_line1: string
  address_line2: string | null
  city: string
  district: string
  postal_code: string | null
  is_default: boolean
}

interface PickedItem {
  variantId: string
  productName: string
  label: string
  price: number
  stock: number
  quantity: number
}

const EMPTY_ADDRESS = {
  label: "",
  recipientName: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  district: "",
  postalCode: "",
}

const LOOKUP_IDLE: CustomerLookupState = { ok: false }
const CREATE_IDLE: AdminOrderCreateState = { ok: false }

export function AdminOrderForm({ catalogue }: { catalogue: CatalogueProduct[] }) {
  const [lookupState, lookupAction] = useActionState(lookupCustomerByNumberAction, LOOKUP_IDLE)
  const [createState, createAction] = useActionState(createAdminOrderAction, CREATE_IDLE)

  const customer = lookupState.ok ? lookupState.customer : undefined
  const savedAddresses: SavedAddress[] = useMemo(
    () => (lookupState.ok ? (lookupState.addresses ?? []) : []),
    [lookupState],
  )

  const [query, setQuery] = useState("")
  const [items, setItems] = useState<PickedItem[]>([])
  const [addressMode, setAddressMode] = useState<{ kind: "saved"; id: string } | { kind: "manual" }>({ kind: "manual" })
  const [manual, setManual] = useState(EMPTY_ADDRESS)
  const [payment, setPayment] = useState<AdminOrderPaymentMethod>("cod")

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("tr")
    if (term.length < 2) return []
    return catalogue
      .map((p) => ({
        ...p,
        variants: p.variants.filter(
          (v) =>
            p.name.toLocaleLowerCase("tr").includes(term) ||
            v.label.toLocaleLowerCase("tr").includes(term),
        ),
      }))
      .filter((p) => p.variants.length > 0)
      .slice(0, 20)
  }, [catalogue, query])

  const estimate = useMemo(
    () => items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    [items],
  )

  function addVariant(productName: string, v: CatalogueVariant) {
    setItems((prev) => {
      const existing = prev.find((i) => i.variantId === v.id)
      if (existing) {
        return prev.map((i) =>
          i.variantId === v.id ? { ...i, quantity: Math.min(99, i.quantity + 1) } : i,
        )
      }
      return [...prev, { variantId: v.id, productName, label: v.label, price: v.price, stock: v.stock, quantity: 1 }]
    })
  }

  function setQty(variantId: string, quantity: number) {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.variantId !== variantId)
        : prev.map((i) => (i.variantId === variantId ? { ...i, quantity: Math.min(99, quantity) } : i)),
    )
  }

  // Kayıtlı adres seçiliyken bir alan düzenlenirse formu o adresin
  // değerleriyle el yazısına çevirir; sonrası serbest metindir.
  const activeAddress = useMemo(() => {
    if (addressMode.kind === "saved") {
      const found = savedAddresses.find((a) => a.id === addressMode.id)
      if (found) {
        return {
          label: found.label,
          recipientName: found.full_name,
          phone: found.phone,
          addressLine1: found.address_line1,
          addressLine2: found.address_line2 ?? "",
          city: found.city,
          district: found.district,
          postalCode: found.postal_code ?? "",
        }
      }
    }
    return manual
  }, [addressMode, savedAddresses, manual])

  function editManual(patch: Partial<typeof EMPTY_ADDRESS>) {
    if (addressMode.kind === "saved") {
      const snapshot = activeAddress
      setAddressMode({ kind: "manual" })
      setManual({ ...EMPTY_ADDRESS, ...snapshot, ...patch })
    } else {
      setManual((m) => ({ ...m, ...patch }))
    }
  }

  const canSubmit = !!customer && items.length > 0

  if (createState.ok && createState.orderId) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-ink">
          {createState.message} Müşteri bu siparişi kendi sipariş geçmişinde görür.
        </p>
        <Link
          href={`/admin/orders/${createState.orderId}`}
          prefetch={false}
          className="inline-flex min-h-11 items-center text-sm text-brand transition-colors duration-300 hover:text-forest"
        >
          Siparişi aç →
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      {/* Adım 1 — müşteri */}
      <section aria-labelledby="yeni-musteri">
        <h2 id="yeni-musteri" className="text-lg tracking-tight">
          1. Müşteri
        </h2>
        <form action={lookupAction} className="mt-4 flex max-w-xl flex-wrap items-end gap-3" noValidate>
          <div className="min-w-52 flex-1">
            <AdminInput
              label="Müşteri numarası"
              name="customer_number"
              placeholder="KE-123456"
              required
              error={lookupState.fieldErrors?.customer_number}
            />
          </div>
          <SubmitButton variant="outline" pendingLabel="Aranıyor…">
            Bul
          </SubmitButton>
        </form>
        <FormMessage
          state={lookupState === LOOKUP_IDLE ? ACTION_IDLE : lookupState}
          className="mt-4 max-w-xl empty:mt-0"
        />
        {customer && (
          <dl className="mt-4 grid max-w-xl gap-3 rounded-[3px] border border-ink/10 bg-ivory/60 p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="label text-olive">Ad soyad</dt>
              <dd className="mt-0.5 text-ink">{customer.fullName}</dd>
            </div>
            <div>
              <dt className="label text-olive">Müşteri no</dt>
              <dd className="figure mt-0.5 text-ink">{customer.customerNumber}</dd>
            </div>
            <div>
              <dt className="label text-olive">E-posta</dt>
              <dd className="mt-0.5 break-all text-ink">{customer.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="label text-olive">Telefon</dt>
              <dd className="mt-0.5 text-ink">{customer.phone ?? "—"}</dd>
            </div>
          </dl>
        )}
      </section>

      {/* Adım 2 — kalemler */}
      <section aria-labelledby="yeni-kalemler">
        <h2 id="yeni-kalemler" className="text-lg tracking-tight">
          2. Ürünler
        </h2>
        <p className="mt-1 text-xs text-ink/50">
          Fiyatlar veritabanından alınır; burada görünen tutar yalnızca ön tahmindir.
        </p>
        <div className="mt-4 max-w-xl">
          <AdminInput
            label="Ürün ara"
            name="urun-ara"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="En az 2 harf yazın"
          />
        </div>
        {filtered.length > 0 && (
          <ul className="mt-3 max-w-xl divide-y divide-ink/[0.07] rounded-[3px] border border-ink/10">
            {filtered.flatMap((p) =>
              p.variants.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-ink">
                      {p.name} · {v.label}
                    </span>
                    <span className="figure block text-xs text-ink/45">
                      {formatCurrency(v.price)} · stok {v.stock}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => addVariant(p.name, v)}
                    disabled={v.stock <= 0}
                    className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-theme-button border border-ink/20 px-4 py-2 text-sm transition-colors duration-200 hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {v.stock <= 0 ? "Yok" : "Ekle"}
                  </button>
                </li>
              )),
            )}
          </ul>
        )}
        {items.length > 0 && (
          <ul className="mt-4 max-w-xl space-y-2">
            {items.map((item) => (
              <li
                key={item.variantId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[3px] border border-ink/10 bg-paper/50 px-4 py-2.5"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">
                    {item.productName} · {item.label}
                  </span>
                  <span className="figure block text-xs text-ink/45">
                    {formatCurrency(item.price)} × {item.quantity} = {formatCurrency(item.price * item.quantity)}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Adedi azalt"
                    onClick={() => setQty(item.variantId, item.quantity - 1)}
                    className="flex h-11 w-11 items-center justify-center border border-ink/20 text-ink hover:text-brand"
                  >
                    −
                  </button>
                  <span className="figure w-8 text-center text-sm">{item.quantity}</span>
                  <button
                    type="button"
                    aria-label="Adedi artır"
                    onClick={() => setQty(item.variantId, Math.min(99, item.quantity + 1))}
                    className="flex h-11 w-11 items-center justify-center border border-ink/20 text-ink hover:text-brand"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => setQty(item.variantId, 0)}
                    className="ml-1 inline-flex min-h-11 items-center text-xs text-ink/50 hover:text-clay"
                  >
                    Kaldır
                  </button>
                </span>
              </li>
            ))}
            <li className="flex justify-between gap-4 px-4 pt-1 text-sm">
              <span className="text-ink/60">Ön tahmin (ara toplam)</span>
              <span className="figure font-medium text-ink">{formatCurrency(estimate)}</span>
            </li>
          </ul>
        )}
      </section>

      {/* Adım 3 — adres, ödeme, onam */}
      <section aria-labelledby="yeni-tamamla">
        <h2 id="yeni-tamamla" className="text-lg tracking-tight">
          3. Adres, ödeme ve kayıt
        </h2>
        <form action={createAction} className="mt-4 max-w-xl space-y-4" noValidate>
          <input type="hidden" name="customer_id" value={customer?.id ?? ""} />
          <input
            type="hidden"
            name="items"
            value={JSON.stringify(items.map((i) => ({ variant_id: i.variantId, quantity: i.quantity })))}
          />
          <input type="hidden" name="shipping_address" value={JSON.stringify(activeAddress)} />
          <input type="hidden" name="payment_method" value={payment} />

          {savedAddresses.length > 0 && (
            <AdminSelect
              label="Kayıtlı adres"
              value={addressMode.kind === "saved" ? addressMode.id : ""}
              onChange={(e) =>
                setAddressMode(e.target.value ? { kind: "saved", id: e.target.value } : { kind: "manual" })
              }
            >
              <option value="">Yeni adres yaz</option>
              {savedAddresses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label} — {a.address_line1}, {a.district}/{a.city}
                  {a.is_default ? " (varsayılan)" : ""}
                </option>
              ))}
            </AdminSelect>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <AdminInput
              label="Adres başlığı"
              name="addr-label"
              value={activeAddress.label}
              onChange={(e) => editManual({ label: e.target.value })}
              placeholder="Ev, İş…"
            />
            <AdminInput
              label="Alıcı adı"
              name="addr-recipient"
              required
              value={activeAddress.recipientName}
              onChange={(e) => editManual({ recipientName: e.target.value })}
            />
            <AdminInput
              label="Telefon"
              name="addr-phone"
              required
              value={activeAddress.phone}
              onChange={(e) => editManual({ phone: e.target.value })}
            />
            <AdminInput
              label="İl"
              name="addr-city"
              required
              value={activeAddress.city}
              onChange={(e) => editManual({ city: e.target.value })}
            />
            <AdminInput
              label="İlçe"
              name="addr-district"
              required
              value={activeAddress.district}
              onChange={(e) => editManual({ district: e.target.value })}
            />
            <AdminInput
              label="Posta kodu"
              name="addr-postal"
              value={activeAddress.postalCode}
              onChange={(e) => editManual({ postalCode: e.target.value })}
            />
          </div>
          <AdminInput
            label="Adres"
            name="addr-line1"
            required
            value={activeAddress.addressLine1}
            onChange={(e) => editManual({ addressLine1: e.target.value })}
          />
          <AdminInput
            label="Adres (2. satır)"
            name="addr-line2"
            value={activeAddress.addressLine2}
            onChange={(e) => editManual({ addressLine2: e.target.value })}
          />

          <fieldset>
            <legend className="label text-olive">Ödeme yöntemi</legend>
            <div className="mt-2 flex flex-wrap gap-3">
              {(Object.keys(ADMIN_ORDER_PAYMENT_LABELS) as AdminOrderPaymentMethod[]).map((method) => (
                <label
                  key={method}
                  className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-theme-button border px-5 text-sm transition-colors duration-200 ${
                    payment === method ? "border-brand bg-brand/5 text-ink" : "border-ink/20 text-ink/70"
                  }`}
                >
                  <input
                    type="radio"
                    name="odeme-secim"
                    checked={payment === method}
                    onChange={() => setPayment(method)}
                    className="h-4 w-4 accent-[var(--color-brand)]"
                  />
                  {ADMIN_ORDER_PAYMENT_LABELS[method]}
                </label>
              ))}
            </div>
          </fieldset>

          <AdminTextarea
            label="İç not"
            name="admin_note"
            rows={2}
            hint="Opsiyonel. Yalnızca yöneticiler görür."
            error={createState.fieldErrors?.admin_note}
          />
          <AdminTextarea
            label="Onam beyanı (zorunlu)"
            name="consent_note"
            rows={2}
            required
            placeholder="Örn. Telefonda sözlü onay alındı."
            hint="Müşteri kutucuk işaretlemedi; onayın nasıl alındığını açık yazın. Sipariş kaydına ve denetime işlenir."
            error={createState.fieldErrors?.consent_note}
          />

          <FormMessage state={createState === CREATE_IDLE ? ACTION_IDLE : createState} />

          <SubmitButton disabled={!canSubmit} pendingLabel="Oluşturuluyor…">
            Siparişi oluştur
          </SubmitButton>
          {!customer && (
            <p className="text-xs text-ink/50">Önce 1. adımda müşteriyi bulun.</p>
          )}
          {customer && items.length === 0 && (
            <p className="text-xs text-ink/50">Siparişe en az bir ürün ekleyin.</p>
          )}
        </form>
      </section>
    </div>
  )
}
