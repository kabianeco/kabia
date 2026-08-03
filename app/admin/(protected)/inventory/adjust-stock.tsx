"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { adjustStockAction } from "./actions"
import { ACTION_IDLE } from "@/lib/admin/errors"
import {
  AdminButton,
  AdminInput,
  AdminSelect,
  AdminTextarea,
  FormMessage,
  SubmitButton,
} from "@/components/admin/ui/form"

/**
 * Stock adjustment dialog.
 *
 * Shows the resulting quantity before anything is submitted, so the operator
 * confirms an outcome rather than an arithmetic operation. A reason is
 * mandatory — the database enforces that too — because an unexplained stock
 * movement is unauditable by definition.
 *
 * Built on <dialog>, so Escape, the focus trap and focus restoration come from
 * the platform.
 */

const REASONS = [
  "Sayım düzeltmesi",
  "Stokta yok",
  "Yeni sevkiyat",
  "Hasarlı ürün",
  "İade girişi",
  "Numune / tadım",
  "Manuel satış",
  "Diğer",
] as const

export function AdjustStockButton({
  variantId,
  productName,
  variantLabel,
  currentStock,
}: {
  variantId: string
  productName: string
  variantLabel: string
  currentStock: number
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState(adjustStockAction, ACTION_IDLE)
  const [direction, setDirection] = useState<"increase" | "decrease">("increase")
  const [quantity, setQuantity] = useState("1")
  const [reason, setReason] = useState<string>(REASONS[0])

  const parsedQuantity = Number(quantity)
  const delta = Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? Math.floor(parsedQuantity) : 0
  const projected = direction === "increase" ? currentStock + delta : currentStock - delta
  const wouldGoNegative = projected < 0

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const onClose = () => setOpen(false)
    dialog.addEventListener("close", onClose)
    return () => dialog.removeEventListener("close", onClose)
  }, [])

  // Close and refresh once the server confirms the movement.
  useEffect(() => {
    if (state.ok && open) {
      const timer = setTimeout(() => {
        setOpen(false)
        setQuantity("1")
        router.refresh()
      }, 900)
      return () => clearTimeout(timer)
    }
  }, [state.ok, open, router])

  return (
    <>
      <AdminButton variant="outline" onClick={() => setOpen(true)}>
        Stok güncelle
      </AdminButton>

      <dialog
        ref={dialogRef}
        aria-labelledby={`adjust-title-${variantId}`}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-[5px] border border-ink/15 bg-ivory p-0 text-ink backdrop:bg-ink/40"
        onClick={(event) => {
          if (event.target === dialogRef.current) dialogRef.current?.close()
        }}
      >
        <form action={formAction} className="flex flex-col">
          <input type="hidden" name="variant_id" value={variantId} />
          <input type="hidden" name="direction" value={direction} />

          <div className="px-5 pb-4 pt-5">
            <h2 id={`adjust-title-${variantId}`} className="font-serif text-xl leading-tight">
              Stok güncelleme
            </h2>
            <p className="mt-1 text-sm text-ink/60">
              {productName} · {variantLabel}
            </p>

            <div className="mt-5 space-y-4">
              <AdminButton
                variant="danger"
                className="w-full justify-center"
                disabled={currentStock <= 0}
                onClick={() => {
                  setDirection("decrease")
                  setQuantity(String(currentStock))
                  setReason("Stokta yok")
                }}
              >
                Stokta yok olarak işaretle
              </AdminButton>

              <fieldset>
                <legend className="label mb-2 text-olive">Yön</legend>
                <div className="flex gap-2">
                  <AdminButton
                    variant={direction === "increase" ? "primary" : "outline"}
                    aria-pressed={direction === "increase"}
                    onClick={() => setDirection("increase")}
                  >
                    Stok ekle
                  </AdminButton>
                  <AdminButton
                    variant={direction === "decrease" ? "primary" : "outline"}
                    aria-pressed={direction === "decrease"}
                    onClick={() => setDirection("decrease")}
                  >
                    Stok çıkar
                  </AdminButton>
                </div>
              </fieldset>

              <AdminInput
                label="Miktar"
                name="quantity"
                inputMode="numeric"
                required
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                error={state.fieldErrors?.quantity}
              />

              <AdminSelect
                label="Gerekçe"
                name="reason"
                required
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                error={state.fieldErrors?.reason}
              >
                {REASONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </AdminSelect>

              <AdminTextarea
                label="İç not"
                name="note"
                rows={2}
                hint="Opsiyonel. Yalnızca yöneticiler görür."
                error={state.fieldErrors?.note}
              />

              <dl className="grid grid-cols-2 gap-3 rounded-[3px] border border-ink/10 bg-paper/60 px-4 py-3">
                <div>
                  <dt className="label text-olive">Mevcut stok</dt>
                  <dd className="figure mt-1 text-lg text-ink">{currentStock}</dd>
                </div>
                <div>
                  <dt className="label text-olive">Sonuç</dt>
                  <dd
                    className={`figure mt-1 text-lg ${wouldGoNegative ? "text-clay" : "text-brand"}`}
                  >
                    {projected}
                  </dd>
                </div>
              </dl>

              {wouldGoNegative && (
                <p role="alert" className="text-xs text-clay">
                  Stok negatife düşemez. Miktarı azaltın.
                </p>
              )}

              <FormMessage state={state} />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-ink/10 px-5 py-4 sm:flex-row sm:justify-end">
            <AdminButton variant="ghost" onClick={() => dialogRef.current?.close()}>
              İptal
            </AdminButton>
            <SubmitButton disabled={wouldGoNegative || delta === 0} pendingLabel="Uygulanıyor…">
              Güncelle
            </SubmitButton>
          </div>
        </form>
      </dialog>
    </>
  )
}
