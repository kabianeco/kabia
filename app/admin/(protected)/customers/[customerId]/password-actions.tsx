"use client"

import { useActionState, useState } from "react"
import { ACTION_IDLE } from "@/lib/admin/errors"
import {
  AdminInput,
  AdminTextarea,
  FormMessage,
  SubmitButton,
} from "@/components/admin/ui/form"
import {
  sendCustomerRecoveryAction,
  setCustomerPasswordAction,
  type RecoverySendState,
  type SetPasswordState,
} from "./actions"

const RECOVERY_IDLE: RecoverySendState = { ok: false }
const SET_IDLE: SetPasswordState = { ok: false }

/**
 * Müşteri parola işlemleri (Feature 3).
 *
 * a) Şifre yenileme bağlantısı: standart recovery e-postası. Önce onay.
 * b) Şifre belirle: SADECE süper yönetici. Gerekçe zorunlu; parola sunucuda
 *    üretilip yanıtta bir kez gösterilir ya da elle girilir (müşteri
 *    kurallarıyla aynı: en az 8). Parola hiçbir yere loglanmaz.
 */
export function CustomerPasswordActions({
  customerId,
  customerName,
  canSetPassword,
}: {
  customerId: string
  customerName: string
  canSetPassword: boolean
}) {
  return (
    <div className="space-y-8">
      <RecoverySender customerId={customerId} customerName={customerName} />
      {canSetPassword && <PasswordSetter customerId={customerId} />}
    </div>
  )
}

function RecoverySender({ customerId, customerName }: { customerId: string; customerName: string }) {
  const [state, formAction] = useActionState(sendCustomerRecoveryAction, RECOVERY_IDLE)
  const [confirming, setConfirming] = useState(false)

  return (
    <form action={formAction} className="space-y-3" noValidate>
      <input type="hidden" name="customer_id" value={customerId} />
      <p className="text-sm leading-relaxed text-ink/70">
        <span className="font-medium text-ink">Şifre yenileme bağlantısı gönder</span>
        <br />
        {customerName} adlı müşteriye standart şifre sıfırlama e-postası gider.
      </p>
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="inline-flex min-h-11 items-center rounded-full border border-ink/20 px-5 text-sm text-ink transition-colors duration-200 hover:border-brand hover:text-brand"
        >
          Bağlantı gönder…
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <SubmitButton variant="outline" pendingLabel="Gönderiliyor…">
            Evet, gönder
          </SubmitButton>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="text-sm text-ink/50 hover:text-ink"
          >
            Vazgeç
          </button>
        </div>
      )}
      <FormMessage state={state === RECOVERY_IDLE ? ACTION_IDLE : state} />
    </form>
  )
}

function PasswordSetter({ customerId }: { customerId: string }) {
  const [state, formAction] = useActionState(setCustomerPasswordAction, SET_IDLE)
  const [mode, setMode] = useState<"generate" | "manual">("generate")
  const [reason, setReason] = useState("")
  const [confirmed, setConfirmed] = useState(false)
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <div className="border-t border-ink/10 pt-5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm text-clay transition-colors hover:text-red-700"
        >
          Şifre belirle (süper yönetici) ↓
        </button>
      </div>
    )
  }

  const canSubmit = reason.trim().length >= 3 && confirmed

  return (
    <form action={formAction} className="space-y-3 border-t border-ink/10 pt-5" noValidate>
      <input type="hidden" name="customer_id" value={customerId} />
      <input type="hidden" name="mode" value={mode} />

      <div className="rounded-[3px] border border-clay/30 bg-clay/5 p-3">
        <p className="text-sm font-medium text-clay">Müşteri şifresini doğrudan belirleme</p>
        <p className="mt-1 text-xs leading-relaxed text-ink/60">
          Yalnızca süper yönetici. Müşterinin diğer oturumları kapatılır, ilk
          girişinde şifresini değiştirmesi istenir ve müşteriye bildirim
          e-postası gider. Parola yanıtta bir kez gösterilir, hiçbir yere
          kaydedilmez.
        </p>
      </div>

      <fieldset>
        <legend className="label text-olive">Parola yöntemi</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {(
            [
              ["generate", "Sunucu üretsin (önerilen)"],
              ["manual", "Elle yaz"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-ink/20 px-5 text-sm text-ink/70"
            >
              <input
                type="radio"
                name="yontem-secim"
                checked={mode === value}
                onChange={() => setMode(value)}
                className="h-4 w-4"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {mode === "manual" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <AdminInput
            label="Yeni şifre"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            hint="En az 8 karakter."
            error={state.fieldErrors?.password}
          />
          <AdminInput
            label="Yeni şifre (tekrar)"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            error={state.fieldErrors?.confirm}
          />
        </div>
      )}

      <AdminTextarea
        label="Gerekçe (zorunlu)"
        name="reason"
        rows={2}
        required
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        hint="Neden doğrudan şifre belirlendiğini yazın. Denetim kaydına işlenir."
        error={state.fieldErrors?.reason}
      />

      <label className="flex items-center gap-2 text-sm text-ink/70">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="h-4 w-4 rounded border-ink/20"
        />
        Müşterinin diğer oturumlarının kapatılacağını onaylıyorum.
      </label>

      <FormMessage state={state === SET_IDLE ? ACTION_IDLE : state} />

      {state.ok && state.generatedPassword && (
        <div role="status" className="rounded-[3px] border border-brand/30 bg-brand/5 p-4">
          <p className="label text-olive">Tek seferlik parola — müşteriye iletin</p>
          <p className="figure mt-2 break-all text-lg text-ink">{state.generatedPassword}</p>
          <p className="mt-1 text-xs text-ink/50">
            Bu parola bir daha gösterilmeyecek ve hiçbir yere kaydedilmedi.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <SubmitButton variant="outline" disabled={!canSubmit} pendingLabel="Belirleniyor…">
          Şifreyi belirle
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
