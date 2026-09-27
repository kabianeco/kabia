"use client";

import { Button } from "@/components/ui/button";
import { isPaymentValid } from "./validation";
import type { PaymentData, PaymentMethod } from "./types";

const METHODS: { id: PaymentMethod; label: string; detail: string }[] = [
  { id: "cod", label: "Kapıda ödeme", detail: "Teslimatta nakit veya kart" },
];

export function PaymentStep({
  payment,
  onPaymentChange,
  onContinue,
  onBack,
}: {
  payment: PaymentData;
  onPaymentChange: (data: PaymentData) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const valid = isPaymentValid(payment);
  const set = (patch: Partial<PaymentData>) =>
    onPaymentChange({ ...payment, ...patch });

  return (
    <section aria-labelledby="payment-heading">
      <h1 id="payment-heading" className="text-3xl tracking-tight md:text-4xl">
        Ödeme
      </h1>

      <fieldset className="mt-10">
        <legend className="label text-olive">Ödeme yöntemi</legend>
        <ul className="mt-4 border-t border-ink/10">
          {METHODS.map((method) => (
            <li key={method.id} className="border-b border-ink/10">
              <label className="flex min-h-14 cursor-pointer items-center gap-4 py-4">
                <input
                  type="radio"
                  name="payment-method"
                  checked={payment.method === method.id}
                  onChange={() => set({ method: method.id })}
                  className="h-4 w-4 shrink-0 accent-[var(--color-brand)]"
                />
                <span>
                  <span className="block text-sm text-ink">{method.label}</span>
                  <span className="mt-0.5 block text-xs text-ink/50">
                    {method.detail}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="mt-14 flex flex-wrap items-center gap-7">
        <Button size="lg" disabled={!valid} onClick={onContinue}>
          Özete geç
        </Button>
        <button
          type="button"
          onClick={onBack}
          className="min-h-11 text-sm text-ink/55 transition-colors hover:text-ink"
        >
          Sepete dön
        </button>
      </div>
    </section>
  );
}
