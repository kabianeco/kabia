"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useCards } from "@/lib/cards-context";
import { CardEntryForm } from "@/components/account/card-entry-form";
import { Button } from "@/components/ui/button";

const BRAND_LABELS: Record<string, string> = {
  visa: "VISA",
  mastercard: "Mastercard",
  troy: "Troy",
};

export default function SavedCardsPage() {
  const { cards, removeCard, setDefaultCard, hydrated } = useCards();
  const [addingNew, setAddingNew] = useState(false);

  if (!hydrated) {
    return (
      <div className="min-h-[40vh]" aria-busy="true">
        <span className="sr-only">Kartlarınız yükleniyor</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-3xl tracking-tight md:text-4xl">Kartlarım</h1>
        {!addingNew && (
          <Button variant="outline" size="sm" onClick={() => setAddingNew(true)}>
            Yeni kart
          </Button>
        )}
      </div>

      {addingNew && (
        <div className="mt-10">
          <CardEntryForm
            onSaved={() => {
              setAddingNew(false);
              toast.success("Kart kaydedildi.");
            }}
            onCancel={() => setAddingNew(false)}
          />
        </div>
      )}

      {cards.length === 0 && !addingNew ? (
        <p className="mt-10 max-w-sm text-base leading-relaxed text-ink/60">
          Kayıtlı kartınız yok. Ödemeyi hızlandırmak için bir kart ekleyin —
          yalnızca son dört hane ve son kullanma tarihi saklanır.
        </p>
      ) : (
        <ul className="mt-12 border-t border-ink/10">
          {cards.map((card) => (
            <li
              key={card.id}
              className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-ink/10 py-6"
            >
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-3">
                  <span className="label text-olive">
                    {card.brand ? BRAND_LABELS[card.brand] : "Kart"}
                  </span>
                  {card.isDefault && (
                    <span className="label text-brand">Varsayılan</span>
                  )}
                </span>
                <span className="figure mt-2 block text-base text-ink">
                  •••• {card.last4}
                </span>
                <span className="mt-1 block text-xs text-ink/50">
                  {card.cardName} · {card.expiry}
                </span>
              </span>

              <span className="flex items-center gap-6 text-sm">
                {!card.isDefault && (
                  <button
                    type="button"
                    onClick={() => setDefaultCard(card.id)}
                    className="min-h-11 text-ink/55 transition-colors hover:text-ink"
                  >
                    Varsayılan yap
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeCard(card.id)}
                  className="min-h-11 text-ink/45 transition-colors hover:text-clay"
                >
                  Sil
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
