"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { CardPreview, detectNetwork } from "@/components/checkout/card-preview";
import {
  formatCVV,
  formatCardNumber,
  formatExpiry,
} from "@/components/checkout/validation";
import { useCards } from "@/lib/cards-context";

/**
 * Only the brand, last four digits, expiry and cardholder name are saved. The
 * full number and the CVV never leave this component's local state.
 */
export function CardEntryForm({
  onSaved,
  onCancel,
}: {
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const { addCard } = useCards();
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [cvvFocused, setCvvFocused] = useState(false);
  const [saving, setSaving] = useState(false);

  const digits = cardNumber.replace(/\s/g, "");
  const expiryMatch = /^(\d{2})\/(\d{2})$/.exec(expiry);
  const valid =
    cardName.trim().length > 1 &&
    /^\d{16}$/.test(digits) &&
    !!expiryMatch &&
    Number(expiryMatch[1]) >= 1 &&
    Number(expiryMatch[1]) <= 12 &&
    /^\d{3}$/.test(cvv);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    await addCard({
      brand: detectNetwork(digits),
      last4: digits.slice(-4),
      expiry,
      cardName: cardName.trim(),
    });
    setCardName("");
    setCardNumber("");
    setExpiry("");
    setCvv("");
    setSaving(false);
    onSaved?.();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border-l-2 border-brand/40 bg-paper/60 px-5 py-6 sm:px-7"
    >
      <div className="grid items-start gap-10 lg:grid-cols-[1fr_18rem]">
        <div className="grid gap-6 sm:grid-cols-2">
          <TextField
            label="Kart üzerindeki isim"
            value={cardName}
            onChange={(e) => setCardName(e.target.value)}
            autoComplete="cc-name"
            wrapperClassName="sm:col-span-2"
            required
          />
          <TextField
            label="Kart numarası"
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="0000 0000 0000 0000"
            className="figure"
            wrapperClassName="sm:col-span-2"
            required
          />
          <TextField
            label="Son kullanma"
            value={expiry}
            onChange={(e) => setExpiry(formatExpiry(e.target.value))}
            inputMode="numeric"
            autoComplete="cc-exp"
            placeholder="MM/YY"
            className="figure"
            required
          />
          <TextField
            label="CVV"
            value={cvv}
            onChange={(e) => setCvv(formatCVV(e.target.value))}
            onFocus={() => setCvvFocused(true)}
            onBlur={() => setCvvFocused(false)}
            inputMode="numeric"
            autoComplete="cc-csc"
            placeholder="000"
            className="figure"
            hint="Kaydedilmez"
            required
          />
        </div>

        <CardPreview
          payment={{ method: "card", cardName, cardNumber, expiry, cvv }}
          flipped={cvvFocused}
        />
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-6">
        <Button type="submit" disabled={!valid || saving}>
          {saving ? "Kaydediliyor…" : "Kartı kaydet"}
        </Button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 text-sm text-ink/55 transition-colors hover:text-ink"
          >
            Vazgeç
          </button>
        )}
      </div>
    </form>
  );
}
