"use client";

import { useState } from "react";
import { useCheckout, type SavedAddress } from "@/lib/checkout-context";
import { AddressForm } from "@/components/cart/address-form";
import { Button } from "@/components/ui/button";

export default function AddressesPage() {
  const {
    addresses,
    defaultAddressId,
    setDefaultAddress,
    removeAddress,
    hydrated,
  } = useCheckout();
  const [editing, setEditing] = useState<SavedAddress | null>(null);
  const [adding, setAdding] = useState(false);

  if (!hydrated) {
    return (
      <div className="min-h-[40vh]" aria-busy="true">
        <span className="sr-only">Adresleriniz yükleniyor</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-3xl tracking-tight md:text-4xl">Adreslerim</h1>
        {!adding && !editing && (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            Yeni adres
          </Button>
        )}
      </div>

      {addresses.length === 0 && !adding ? (
        <p className="mt-10 max-w-sm text-base leading-relaxed text-ink/60">
          Kayıtlı adresiniz yok. Bir adres ekleyin, siparişlerinizde tekrar
          girmeniz gerekmesin.
        </p>
      ) : (
        <ul className="mt-12 border-t border-ink/10">
          {addresses.map((address) => (
            <li key={address.id} className="border-b border-ink/10 py-6">
              {editing?.id === address.id ? (
                <AddressForm
                  editing={address}
                  onSaved={() => setEditing(null)}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-base text-ink">{address.label}</h2>
                    {address.id === defaultAddressId && (
                      <span className="label text-brand">Varsayılan</span>
                    )}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-ink/60">
                    {address.recipientName} · {address.phone}
                    <br />
                    {address.addressLine1}
                    {address.addressLine2 && `, ${address.addressLine2}`}
                    <br />
                    {address.district} / {address.city} {address.postalCode}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-6 text-sm">
                    <button
                      type="button"
                      onClick={() => setEditing(address)}
                      className="min-h-11 text-brand transition-colors hover:text-forest"
                    >
                      Düzenle
                    </button>
                    {address.id !== defaultAddressId && (
                      <button
                        type="button"
                        onClick={() => setDefaultAddress(address.id)}
                        className="min-h-11 text-ink/55 transition-colors hover:text-ink"
                      >
                        Varsayılan yap
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeAddress(address.id)}
                      className="min-h-11 text-ink/45 transition-colors hover:text-clay"
                    >
                      Sil
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <div className="mt-8">
          <AddressForm
            onSaved={() => setAdding(false)}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}
    </div>
  );
}
