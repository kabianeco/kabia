"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { sendContactMessage } from "@/app/iletisim/actions";
import { Checkbox } from "@/components/ui/field";
import { routes } from "@/lib/site";
import type { ActionState } from "@/lib/admin/errors";

/** Local rather than imported so the public bundle keeps no admin module. */
const IDLE: ActionState = { ok: false };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 shrink-0 items-center rounded-theme-button bg-brand px-7 text-sm font-medium text-on-brand transition-colors duration-300 hover:bg-forest disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Kaydediliyor…" : "Haber ver"}
    </button>
  );
}

/**
 * Hasat bildirimi: tek e-posta kutusu. İletişim altyapısını kullanır —
 * konu sabit "diger", isim ve mesaj sabittir; yöneticinin gelen kutusunda
 * "Hasat başlayınca haber verin." satırıyla görünür. Ayrı tabloya ancak
 * satış başlayınca ihtiyaç olur.
 */
export function NotifyForm() {
  const [state, formAction] = useActionState(sendContactMessage, IDLE);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  const errors = state.fieldErrors ?? {};

  return (
    <form ref={formRef} action={formAction} noValidate>
      <input type="hidden" name="subject" value="diger" />
      <input type="hidden" name="name" value="Ön sipariş listesi" />
      <input
        type="hidden"
        name="message"
        value="Ön sipariş açılınca haber verin."
      />
      <div className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor="notify-email" className="sr-only">
          E-posta adresiniz
        </label>
        <input
          id="notify-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          maxLength={254}
          placeholder="ornek@eposta.com"
          aria-invalid={errors.email ? true : undefined}
          className="min-h-11 w-full rounded-theme-input border border-ink/20 bg-ivory px-5 text-sm text-ink placeholder:text-ink/40 focus:border-brand focus:outline-none"
        />
        <SubmitButton />
      </div>
      {/* §5.1: explicit consent for commercial electronic messaging (6563/İYS).
          Unchecked by default; the server rejects the submission without it. */}
      <Checkbox
        name="kvkk"
        value="1"
        className="mt-3"
        aria-invalid={errors.kvkk ? true : undefined}
        label={
          <span className="leading-relaxed">
            <Link href={routes.kvkkDisclosure} target="_blank" className="text-brand hover:text-forest underline underline-offset-4">
              KVKK Aydınlatma Metni
            </Link>
            ’ni okudum; hasat ve ön sipariş bildirimleri için{" "}
            <Link href={routes.explicitConsent} target="_blank" className="text-brand hover:text-forest underline underline-offset-4">
              Açık Rıza Metni
            </Link>{" "}
            kapsamında e-posta almayı onaylıyorum. <span className="text-clay">*</span>
          </span>
        }
      />
      {errors.kvkk && (
        <p role="alert" className="mt-1 text-sm text-clay">{errors.kvkk}</p>
      )}
      <p aria-live="polite" className="mt-3 min-h-5 text-sm">
        {state.message && (
          <span className={state.ok ? "text-brand" : "text-clay"}>
            {state.ok
              ? "Listedesin. Ön sipariş açılınca ilk sana yazacağız."
              : state.message}
          </span>
        )}
        {errors.email && (
          <span className="text-clay">{errors.email}</span>
        )}
      </p>
    </form>
  );
}
