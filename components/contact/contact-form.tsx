"use client"

import Link from "next/link"
import { useActionState, useEffect, useRef } from "react"
import { useFormStatus } from "react-dom"
import { sendContactMessage } from "@/app/iletisim/actions"
import { CONTACT_SUBJECTS } from "@/lib/contact"
import { routes } from "@/lib/site"
import { Checkbox, SelectField, TextAreaField, TextField } from "@/components/ui/field"
import type { ActionState } from "@/lib/admin/errors"

/** Local rather than imported so the public bundle keeps no admin module. */
const IDLE: ActionState = { ok: false }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-theme-button bg-brand px-8 py-4 text-sm font-medium text-on-brand transition-colors duration-300 hover:bg-forest disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Gönderiliyor…" : "Mesajı gönder"}
    </button>
  )
}

/**
 * The İletişim form.
 *
 * Uncontrolled on purpose: nothing here needs to react to a keystroke, so the
 * fields keep their own values and the only state worth holding is what the
 * server said. That also makes the reset after a successful send a one-liner
 * — the form empties itself rather than five setStates having to agree.
 *
 * The result is announced through a live region instead of only being coloured,
 * so a screen reader hears the same "it arrived" a sighted visitor sees.
 */
export function ContactForm() {
  const [state, formAction] = useActionState(sendContactMessage, IDLE)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.ok) formRef.current?.reset()
  }, [state.ok])

  const errors = state.fieldErrors ?? {}

  return (
    <form ref={formRef} action={formAction} className="space-y-6" noValidate>
      <div className="grid gap-6 sm:grid-cols-2">
        <TextField
          label="Ad soyad"
          name="name"
          autoComplete="name"
          maxLength={120}
          error={errors.name}
          required
        />
        <TextField
          label="E-posta"
          name="email"
          type="email"
          inputMode="email"
          placeholder="ornek@eposta.com"
          autoComplete="email"
          maxLength={254}
          error={errors.email}
          required
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* The optional-ness lives in the label rather than in a `hint`: a hint
            is a second line under the label, which drops this input below the
            select beside it and breaks the row's alignment. */}
        <TextField
          label="Telefon (isteğe bağlı)"
          name="phone"
          type="tel"
          inputMode="tel"
          placeholder="Aranmayı tercih ederseniz"
          autoComplete="tel"
          maxLength={32}
          error={errors.phone}
        />
        <SelectField label="Konu" name="subject" defaultValue="" error={errors.subject} required>
          <option value="" disabled>
            Seçiniz
          </option>
          {CONTACT_SUBJECTS.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.label}
            </option>
          ))}
        </SelectField>
      </div>

      <TextAreaField
        label="Mesajınız"
        name="message"
        rows={6}
        maxLength={4000}
        error={errors.message}
        required
      />

      {/* §5.1: explicit KVKK consent. Unchecked by default; the server
          rejects the submission without it. */}
      <Checkbox
        name="kvkk"
        value="1"
        aria-invalid={errors.kvkk ? true : undefined}
        label={
          <span className="leading-relaxed">
            <Link href={routes.kvkkDisclosure} target="_blank" className="text-brand hover:text-forest underline underline-offset-4">
              KVKK Aydınlatma Metni
            </Link>{" "}
            ve{" "}
            <Link href={routes.privacyPolicy} target="_blank" className="text-brand hover:text-forest underline underline-offset-4">
              Gizlilik Politikası
            </Link>
            ’nı okudum, kişisel verilerimin işlenmesini onaylıyorum. <span className="text-clay">*</span>
          </span>
        }
      />
      {errors.kvkk && (
        <p role="alert" className="text-sm text-clay">{errors.kvkk}</p>
      )}

      <div className="flex flex-wrap items-center gap-5">
        <SubmitButton />
        <p aria-live="polite" className="text-sm">
          {state.message && (
            <span className={state.ok ? "text-olive" : "text-clay"}>{state.message}</span>
          )}
        </p>
      </div>
    </form>
  )
}
