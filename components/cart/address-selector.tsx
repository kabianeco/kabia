"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useCheckout } from "@/lib/checkout-context";
import { AddressForm } from "./address-form";

export function AddressSelector() {
  const {
    addresses,
    selectedAddressId,
    defaultAddressId,
    selectAddress,
    removeAddress,
  } = useCheckout();
  const [addingNew, setAddingNew] = useState(false);

  const showForm = addingNew || addresses.length === 0;

  return (
    <div>
      {addresses.length > 0 && (
        <fieldset>
          <legend className="sr-only">Kayıtlı adresler</legend>
          <ul className="border-t border-ink/10">
            {addresses.map((address) => {
              const selected = address.id === selectedAddressId;
              return (
                <li
                  key={address.id}
                  className="flex items-start gap-4 border-b border-ink/10 py-5"
                >
                  <input
                    type="radio"
                    id={`address-${address.id}`}
                    name="saved-address"
                    checked={selected}
                    onChange={() => selectAddress(address.id)}
                    className="mt-1.5 h-4 w-4 shrink-0 accent-[var(--color-brand)]"
                  />
                  <label
                    htmlFor={`address-${address.id}`}
                    className="min-w-0 flex-1 cursor-pointer"
                  >
                    <span className="flex flex-wrap items-center gap-3">
                      <span className="text-sm text-ink">{address.label}</span>
                      {address.id === defaultAddressId && (
                        <span className="label text-brand">Varsayılan</span>
                      )}
                    </span>
                    <span className="mt-1.5 block text-sm leading-relaxed text-ink/60">
                      {address.recipientName} · {address.phone}
                      <br />
                      {address.addressLine1}
                      {address.addressLine2 && `, ${address.addressLine2}`}
                      <br />
                      {address.district} / {address.city} {address.postalCode}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => removeAddress(address.id)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center text-ink/40 transition-colors hover:text-clay"
                    aria-label={`${address.label} adresini sil`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </fieldset>
      )}

      {showForm ? (
        <div className="mt-6">
          <AddressForm
            onSaved={() => setAddingNew(false)}
            onCancel={addresses.length > 0 ? () => setAddingNew(false) : undefined}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAddingNew(true)}
          className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm text-brand transition-colors hover:text-forest"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Yeni adres ekle
        </button>
      )}
    </div>
  );
}
