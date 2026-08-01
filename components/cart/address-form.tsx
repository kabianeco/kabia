"use client";

import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { useCheckout, type SavedAddress } from "@/lib/checkout-context";
import {
  EMPTY_NEW_ADDRESS,
  isNewAddressValid,
  type NewAddressFields,
} from "./validation";

interface AddressFormProps {
  editing?: SavedAddress;
  onSaved?: () => void;
  onCancel?: () => void;
}

export function AddressForm({ editing, onSaved, onCancel }: AddressFormProps) {
  const { addAddress, updateAddress } = useCheckout();
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<NewAddressFields>(
    editing
      ? {
          label: editing.label,
          recipientName: editing.recipientName,
          phone: editing.phone,
          addressLine1: editing.addressLine1,
          addressLine2: editing.addressLine2,
          city: editing.city,
          district: editing.district,
          postalCode: editing.postalCode,
        }
      : EMPTY_NEW_ADDRESS,
  );

  const set =
    (field: keyof NewAddressFields) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setFields((prev) => ({ ...prev, [field]: e.target.value }));

  const valid = isNewAddressValid(fields);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    const payload = { ...fields, label: fields.label.trim() || "Adresim" };
    if (editing) {
      await updateAddress(editing.id, payload);
    } else {
      await addAddress(payload);
      setFields(EMPTY_NEW_ADDRESS);
    }
    setSaving(false);
    onSaved?.();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border-l-2 border-brand/40 bg-paper/60 px-5 py-6 sm:px-7"
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <TextField
          label="Adres başlığı"
          hint="İsteğe bağlı — Ev, İş…"
          value={fields.label}
          onChange={set("label")}
          wrapperClassName="sm:col-span-2"
        />
        <TextField
          label="Ad soyad"
          value={fields.recipientName}
          onChange={set("recipientName")}
          autoComplete="name"
          required
        />
        <TextField
          label="Telefon"
          type="tel"
          placeholder="05XX XXX XX XX"
          value={fields.phone}
          onChange={set("phone")}
          autoComplete="tel"
          required
        />
        <TextField
          label="Adres"
          value={fields.addressLine1}
          onChange={set("addressLine1")}
          autoComplete="address-line1"
          wrapperClassName="sm:col-span-2"
          required
        />
        <TextField
          label="Adres — ikinci satır"
          hint="İsteğe bağlı"
          value={fields.addressLine2}
          onChange={set("addressLine2")}
          autoComplete="address-line2"
          wrapperClassName="sm:col-span-2"
        />
        <TextField
          label="İl"
          value={fields.city}
          onChange={set("city")}
          autoComplete="address-level1"
          required
        />
        <TextField
          label="İlçe"
          value={fields.district}
          onChange={set("district")}
          autoComplete="address-level2"
          required
        />
        <TextField
          label="Posta kodu"
          value={fields.postalCode}
          onChange={set("postalCode")}
          autoComplete="postal-code"
          inputMode="numeric"
          required
        />
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-6">
        <Button type="submit" disabled={!valid || saving}>
          {saving
            ? "Kaydediliyor…"
            : editing
              ? "Değişiklikleri kaydet"
              : "Adresi kaydet"}
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
