"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  addOrderNoteAction,
  updateOrderStatusAction,
  updateTrackingAction,
  overrideOrderStatusAction,
} from "../actions"
import { ACTION_IDLE } from "@/lib/admin/errors"
import { ORDER_STATUSES, ORDER_TRANSITIONS, canTransition } from "@/lib/admin/orders"
import {
  ORDER_STATUS_LABELS,
  type OrderStatusValue,
} from "@/components/admin/ui/status"
import {
  AdminInput,
  AdminSelect,
  AdminTextarea,
  FormMessage,
  SubmitButton,
} from "@/components/admin/ui/form"

/**
 * Order controls.
 *
 * The status selector shows only valid next states for the current order
 * status, per the transition matrix in lib/admin/orders.ts. The database is the
 * final authority: even if a stale browser sends an invalid transition, the
 * RPC rejects it atomically.
 *
 * A super-admin override path is available separately for operational recovery.
 * It requires a non-empty reason and records a dedicated audit event.
 */

export function OrderStatusControls({
  orderId,
  orderNumber,
  status,
  isSuperAdmin,
}: {
  orderId: string
  orderNumber: string
  status: OrderStatusValue
  isSuperAdmin: boolean
}) {
  const [state, formAction] = useActionState(updateOrderStatusAction, ACTION_IDLE)
  const router = useRouter()
  const [selected, setSelected] = useState<OrderStatusValue>(status)

  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state.ok, router])

  useEffect(() => {
    setSelected(status)
  }, [status])

  const validNext = ORDER_TRANSITIONS[status] ?? []
  const unchanged = selected === status
  const noTransitions = validNext.length === 0

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4" noValidate>
        <input type="hidden" name="order_id" value={orderId} />

        <AdminSelect
          label="Sipariş durumu"
          name="status"
          required
          value={selected}
          onChange={(event) => setSelected(event.target.value as OrderStatusValue)}
        >
          <option value={status}>
            {ORDER_STATUS_LABELS[status]} (mevcut)
          </option>
          {validNext.map((value) => (
            <option key={value} value={value}>
              {ORDER_STATUS_LABELS[value]}
            </option>
          ))}
        </AdminSelect>

        {noTransitions && (
          <p className="text-sm text-ink/50">
            Bu sipariş terminal durumda. Durum değişikliği için süper yönetici
            geçersiz kılma yolunu kullanın.
          </p>
        )}

        <AdminTextarea
          label="İç not / gerekçe"
          name="note"
          rows={2}
          hint="Opsiyonel. Sipariş geçmişine iç not olarak eklenir."
        />

        <FormMessage state={state} />

        <SubmitButton disabled={unchanged || noTransitions} pendingLabel="Güncelleniyor…">
          Durumu güncelle
        </SubmitButton>
      </form>

      {isSuperAdmin && <SuperAdminOverride orderId={orderId} orderNumber={orderNumber} status={status} />}
    </div>
  )
}

function SuperAdminOverride({
  orderId,
  orderNumber,
  status,
}: {
  orderId: string
  orderNumber: string
  status: OrderStatusValue
}) {
  const [state, formAction] = useActionState(overrideOrderStatusAction, ACTION_IDLE)
  const [overrideStatus, setOverrideStatus] = useState<OrderStatusValue>(status)
  const [reason, setReason] = useState("")
  const [confirmed, setConfirmed] = useState(false)
  const [open, setOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state.ok, router])

  if (!open) {
    return (
      <div className="border-t border-ink/10 pt-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm text-clay transition-colors hover:text-red-700"
        >
          Süper yönetici geçersiz kılma ↓
        </button>
      </div>
    )
  }

  const canSubmit = overrideStatus !== status && reason.trim().length > 0 && confirmed

  return (
    <form action={formAction} className="space-y-3 border-t border-ink/10 pt-3" noValidate>
      <input type="hidden" name="order_id" value={orderId} />
      <input type="hidden" name="status" value={overrideStatus} />

      <div className="rounded-[3px] border border-clay/30 bg-clay/5 p-3">
        <p className="text-sm font-medium text-clay">
          Geçersiz durum geçişi — süper yönetici
        </p>
        <p className="mt-1 text-xs text-ink/60">
          Bu işlem yalnızca super_admin tarafından yapılabilir. Normal durum geçiş
          matrisini atlar ve {orderNumber} için denetim kaydına &ldquo;order.status_override&rdquo;
          olarak işlenir.
        </p>
      </div>

      <AdminSelect
        label="Hedef durum"
        required
        value={overrideStatus}
        onChange={(event) => setOverrideStatus(event.target.value as OrderStatusValue)}
      >
        {ORDER_STATUSES.map((value) => (
          <option key={value} value={value}>
            {ORDER_STATUS_LABELS[value]}
            {value === status ? " (mevcut)" : ""}
          </option>
        ))}
      </AdminSelect>

      <AdminTextarea
        label="Gerekçe (zorunlu)"
        name="reason"
        rows={2}
        required
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        hint="Bu geçişin neden gerektiğini açıklayın. Denetim kaydına yazılır."
      />

      <label className="flex items-center gap-2 text-sm text-ink/70">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="h-4 w-4 rounded border-ink/20"
        />
        Bu geçişin normal akışı bozduğunu onaylıyorum.
      </label>

      <FormMessage state={state} />

      <div className="flex gap-2">
        <SubmitButton
          variant="outline"
          disabled={!canSubmit}
          pendingLabel="Geçersiz kılınıyor…"
        >
          Geçersiz kıl
        </SubmitButton>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-ink/50 hover:text-ink"
        >
          İptal
        </button>
      </div>
    </form>
  )
}

export function TrackingForm({
  orderId,
  carrier,
  number,
}: {
  orderId: string
  carrier: string | null
  number: string | null
}) {
  const [state, formAction] = useActionState(updateTrackingAction, ACTION_IDLE)
  const router = useRouter()

  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state.ok, router])

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="order_id" value={orderId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <AdminInput
          label="Kargo firması"
          name="tracking_carrier"
          defaultValue={carrier ?? ""}
          error={state.fieldErrors?.tracking_carrier}
          placeholder="Örn. Aras Kargo"
        />
        <AdminInput
          label="Takip numarası"
          name="tracking_number"
          defaultValue={number ?? ""}
          error={state.fieldErrors?.tracking_number}
        />
      </div>
      <FormMessage state={state} />
      <SubmitButton variant="outline" pendingLabel="Kaydediliyor…">
        Kargo bilgisini kaydet
      </SubmitButton>
    </form>
  )
}

export function OrderNoteForm({ orderId }: { orderId: string }) {
  const [state, formAction] = useActionState(addOrderNoteAction, ACTION_IDLE)
  const router = useRouter()

  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state.ok, router])

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="order_id" value={orderId} />
      <AdminTextarea
        label="Yeni iç not"
        name="note"
        rows={3}
        required
        hint="Yalnızca yöneticiler görür; müşteriye gösterilmez."
        error={state.fieldErrors?.note}
      />
      <FormMessage state={state} />
      <SubmitButton variant="outline" pendingLabel="Ekleniyor…">
        Not ekle
      </SubmitButton>
    </form>
  )
}