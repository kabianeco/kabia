"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { ACTION_IDLE } from "@/lib/admin/errors"
import { retryEmailFetch, setEmailTriage } from "./actions"

function ActionButton({
  op,
  label,
  active,
  danger,
}: {
  op: string
  label: string
  active?: boolean
  danger?: boolean
}) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      name="op"
      value={op}
      disabled={active || pending}
      aria-current={active ? "true" : undefined}
      className={
        active
          ? "rounded-[4px] border border-ink/20 bg-ivory px-3 py-1.5 text-xs text-ink"
          : danger
            ? "rounded-[4px] border border-ink/10 px-3 py-1.5 text-xs text-clay transition-colors hover:border-clay/50 disabled:opacity-50"
            : "rounded-[4px] border border-ink/10 px-3 py-1.5 text-xs text-ink/60 transition-colors hover:border-ink/25 hover:text-ink disabled:opacity-50"
      }
    >
      {label}
    </button>
  )
}

/** Tek iletinin durum düğmeleri: okundu/okunmadı, arşiv, sil. */
export function EmailTriage({
  emailId,
  isRead,
  isArchived,
}: {
  emailId: string
  isRead: boolean
  isArchived: boolean
}) {
  const [state, formAction] = useActionState(setEmailTriage, ACTION_IDLE)

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="emailId" value={emailId} />
      <ActionButton op={isRead ? "okunmadi" : "okundu"} label={isRead ? "Okunmadı işaretle" : "Okundu işaretle"} />
      <ActionButton
        op={isArchived ? "arsivden_cikar" : "arsiv"}
        label={isArchived ? "Arşivden çıkar" : "Arşivle"}
        active={false}
      />
      <ActionButton op="sil" label="Sil" danger />
      {state.message && !state.ok && (
        <span role="alert" className="ml-2 text-xs text-clay">
          {state.message}
        </span>
      )}
    </form>
  )
}

/** Gövdesi çekilemeyen iletinin "yeniden dene" düğmesi. */
export function EmailRetry({ emailId }: { emailId: string }) {
  const [state, formAction] = useActionState(retryEmailFetch, ACTION_IDLE)

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="emailId" value={emailId} />
      <RetryButton />
      {(state.message || state.ok) && (
        <span role={state.ok ? "status" : "alert"} className="text-xs text-ink/60">
          {state.ok ? "Gövde çekildi." : state.message}
        </span>
      )}
    </form>
  )
}

function RetryButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand px-6 text-sm font-medium text-on-brand transition-colors duration-300 hover:bg-forest disabled:opacity-50"
    >
      {pending ? "Çekiliyor…" : "Yeniden dene"}
    </button>
  )
}
