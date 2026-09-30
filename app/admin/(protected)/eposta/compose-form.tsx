"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { ACTION_IDLE } from "@/lib/admin/errors"
import { sendAdminEmail } from "./actions"

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand px-8 text-sm font-medium text-on-brand transition-colors duration-300 hover:bg-forest disabled:opacity-50"
    >
      {pending ? "Gönderiliyor…" : label}
    </button>
  )
}

const inputClass =
  "min-h-11 w-full rounded-[3px] border border-ink/15 bg-ivory px-3 py-2 text-sm text-ink placeholder:text-ink/30 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/40"

/** Yanıt / yeni ileti formu. Gönderim sunucu eylemiyle olur. */
export function ComposeForm({
  defaults,
}: {
  defaults: {
    to: string
    cc: string
    subject: string
    body: string
    replyToEmailId?: string
    replyAll?: boolean
  }
}) {
  const [state, formAction] = useActionState(sendAdminEmail, ACTION_IDLE)

  return (
    <form action={formAction} className="space-y-4">
      {defaults.replyToEmailId && (
        <input type="hidden" name="replyToEmailId" value={defaults.replyToEmailId} />
      )}
      {defaults.replyAll && <input type="hidden" name="replyAll" value="1" />}

      <div>
        <label htmlFor="eposta-to" className="label mb-1.5 block text-olive">
          Alıcı
        </label>
        <input
          id="eposta-to"
          name="to"
          type="email"
          required
          maxLength={254}
          defaultValue={defaults.to}
          placeholder="ornek@eposta.com"
          autoComplete="off"
          className={inputClass}
        />
        {state.fieldErrors?.to && (
          <p role="alert" className="mt-1 text-xs text-clay">
            {state.fieldErrors.to}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="eposta-cc" className="label mb-1.5 block text-olive">
          Kopya <span className="font-normal normal-case text-ink/40">(isteğe bağlı, virgülle ayırın)</span>
        </label>
        <input
          id="eposta-cc"
          name="cc"
          type="text"
          maxLength={1000}
          defaultValue={defaults.cc}
          placeholder="ikinci@eposta.com, ucuncu@eposta.com"
          autoComplete="off"
          className={inputClass}
        />
        {state.fieldErrors?.cc && (
          <p role="alert" className="mt-1 text-xs text-clay">
            {state.fieldErrors.cc}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="eposta-subject" className="label mb-1.5 block text-olive">
          Konu
        </label>
        <input
          id="eposta-subject"
          name="subject"
          type="text"
          required
          maxLength={200}
          defaultValue={defaults.subject}
          className={inputClass}
        />
        {state.fieldErrors?.subject && (
          <p role="alert" className="mt-1 text-xs text-clay">
            {state.fieldErrors.subject}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="eposta-body" className="label mb-1.5 block text-olive">
          İleti
        </label>
        <textarea
          id="eposta-body"
          name="body"
          required
          rows={12}
          maxLength={20000}
          defaultValue={defaults.body}
          className={`${inputClass} min-h-48 leading-relaxed`}
        />
        {state.fieldErrors?.body && (
          <p role="alert" className="mt-1 text-xs text-clay">
            {state.fieldErrors.body}
          </p>
        )}
      </div>

      {state.message && !state.ok && (
        <p role="alert" className="text-sm text-clay">
          {state.message}
        </p>
      )}

      <SubmitButton label="Gönder" />
    </form>
  )
}
