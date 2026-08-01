"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { CardPreview } from "./card-preview";
import {
  formatCVV,
  formatCardNumber,
  formatExpiry,
  isPaymentValid,
} from "./validation";
import type { PaymentData, PaymentMethod } from "./types";

const METHODS: { id: PaymentMethod; label: string; detail: string }[] = [
  { id: "card", label: "Kredi / banka kartı", detail: "Tek çekim" },
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
  const [cvvFocused, setCvvFocused] = useState(false);
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

      {payment.method === "card" && (
        <div className="mt-12 grid gap-12 md:grid-cols-2 md:gap-14">
          <div className="order-2 space-y-7 md:order-1">
            <TextField
              label="Kart üzerindeki isim"
              value={payment.cardName}
              onChange={(e) => set({ cardName: e.target.value })}
              autoComplete="cc-name"
              required
            />
            <TextField
              label="Kart numarası"
              value={payment.cardNumber}
              onChange={(e) =>
                set({ cardNumber: formatCardNumber(e.target.value) })
              }
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="0000 0000 0000 0000"
              className="figure"
              required
            />
            <div className="grid grid-cols-2 gap-6">
              <TextField
                label="Son kullanma"
                value={payment.expiry}
                onChange={(e) => set({ expiry: formatExpiry(e.target.value) })}
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder="MM/YY"
                className="figure"
                required
              />
              <TextField
                label="CVV"
                value={payment.cvv}
                onChange={(e) => set({ cvv: formatCVV(e.target.value) })}
                onFocus={() => setCvvFocused(true)}
                onBlur={() => setCvvFocused(false)}
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder="000"
                className="figure"
                required
              />
            </div>
          </div>

          <div className="order-1 md:order-2">
            <CardPreview payment={payment} flipped={cvvFocused} />
          </div>
        </div>
      )}

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
      {!valid && payment.method === "card" && (
        <p className="mt-4 text-xs text-ink/50">
          Devam etmek için kart bilgilerini eksiksiz girin.
        </p>
      )}
    </section>
  );
}
