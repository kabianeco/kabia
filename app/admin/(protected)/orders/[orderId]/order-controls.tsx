"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  addOrderNoteAction,
  updateOrderStatusAction,
  updateTrackingAction,
} from "../actions"
import { ACTION_IDLE } from "@/lib/admin/errors"
import { ORDER_STATUSES } from "@/lib/admin/orders"
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
 * A single status selector lets administrators move an order to any state.
 * The transition trigger now permits every cross-status move; the audit trail
 * and order_status_history still record the change.
 */

export function OrderStatusControls({
  orderId,
  orderNumber,
  status,
}: {
  orderId: string
  orderNumber: string
  status: OrderStatusValue
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

  const unchanged = selected === status

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="order_id" value={orderId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <AdminSelect
          label="Sipariş durumu"
          name="status"
          required
          value={selected}
          onChange={(event) => setSelected(event.target.value as OrderStatusValue)}
        >
          {ORDER_STATUSES.map((value) => (
            <option key={value} value={value}>
              {ORDER_STATUS_LABELS[value]}
            </option>
          ))}
        </AdminSelect>
      </div>

      <AdminTextarea
        label="İç not / gerekçe"
        name="note"
        rows={2}
        hint="Opsiyonel. Sipariş geçmişine iç not olarak eklenir."
      />

      <FormMessage state={state} />

      <SubmitButton disabled={unchanged} pendingLabel="Güncelleniyor…">
        Durumu güncelle
      </SubmitButton>
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
