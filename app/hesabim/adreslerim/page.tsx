"use client";

import { useState } from "react";
import { useCheckout, type SavedAddress } from "@/lib/checkout-context";
import { AddressForm } from "@/components/cart/address-form";
import { Button } from "@/components/ui/button";
import { AccountError, AccountHeading, AccountLoading } from "@/components/account/account-states";

export default function AddressesPage() {
  const { addresses, defaultAddressId, setDefaultAddress, removeAddress, hydrated, loadError } = useCheckout();
  const [editing, setEditing] = useState<SavedAddress | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  const run = async (id: string, work: () => Promise<boolean>, failure: string) => {
    setBusy(id);
    setRowError(null);
    const ok = await work();
    setBusy(null);
    if (!ok) setRowError({ id, message: failure });
    return ok;
  };

  const quiet = "min-h-11 text-sm transition-colors duration-300 disabled:opacity-55";

  return (
    <div>
      <AccountHeading title="Adreslerim">
        {hydrated && !loadError && !adding && !editing && addresses.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            Yeni adres
          </Button>
        )}
      </AccountHeading>

      {!hydrated ? (
        <AccountLoading label="Adresleriniz yükleniyor" />
      ) : loadError ? (
        <AccountError message="Adresleriniz şu anda yüklenemedi. Sayfayı yenileyip tekrar deneyin." onRetry={() => window.location.reload()} />
      ) : addresses.length === 0 && !adding ? (
        <div className="mt-10 max-w-md">
          <p className="text-base leading-relaxed text-ink/60">
            Kayıtlı adresiniz yok. Bir adres ekleyin, siparişlerinizde tekrar girmeniz gerekmesin.
          </p>
          <Button variant="outline" size="sm" className="mt-6" onClick={() => setAdding(true)}>
            Adres ekle
          </Button>
        </div>
      ) : (
        <ul className="mt-12 border-t border-ink/10">
          {addresses.map((address) => (
            <li key={address.id} className="border-b border-ink/10 py-6">
              {editing?.id === address.id ? (
                <AddressForm editing={address} onSaved={() => setEditing(null)} onCancel={() => setEditing(null)} />
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-base text-ink">{address.label}</h2>
                    {address.id === defaultAddressId && <span className="label text-brand">Varsayılan</span>}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-ink/60">
                    {address.recipientName} · {address.phone}
                    <br />
                    {address.addressLine1}
                    {address.addressLine2 && `, ${address.addressLine2}`}
                    <br />
                    {address.district} / {address.city} {address.postalCode}
                  </p>

                  {confirmingDelete === address.id ? (
                    <div className="mt-4 flex flex-wrap items-center gap-6 text-sm" role="group" aria-label="Silme onayı">
                      <span className="text-ink/70">Bu adres silinsin mi?</span>
                      <button
                        type="button"
                        disabled={busy === address.id}
                        onClick={async () => {
                          if (await run(address.id, () => removeAddress(address.id), "Adres silinemedi. Lütfen tekrar deneyin.")) setConfirmingDelete(null);
                        }}
                        className={`${quiet} text-clay hover:text-ink`}
                      >
                        {busy === address.id ? "Siliniyor…" : "Evet, sil"}
                      </button>
                      <button type="button" onClick={() => setConfirmingDelete(null)} className={`${quiet} text-ink/55 hover:text-ink`}>
                        Vazgeç
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-wrap items-center gap-6 text-sm">
                      <button type="button" onClick={() => setEditing(address)} className={`${quiet} text-brand hover:text-forest`}>
                        Düzenle
                      </button>
                      {address.id !== defaultAddressId && (
                        <button
                          type="button"
                          disabled={busy === address.id}
                          onClick={() => run(address.id, () => setDefaultAddress(address.id), "Varsayılan adres değiştirilemedi. Lütfen tekrar deneyin.")}
                          className={`${quiet} text-ink/55 hover:text-ink`}
                        >
                          Varsayılan yap
                        </button>
                      )}
                      <button type="button" onClick={() => setConfirmingDelete(address.id)} className={`${quiet} text-ink/45 hover:text-clay`}>
                        Sil
                      </button>
                    </div>
                  )}
                  {rowError?.id === address.id && (
                    <p role="alert" className="mt-2 text-sm text-clay">
                      {rowError.message}
                    </p>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <div className="mt-8">
          <AddressForm onSaved={() => setAdding(false)} onCancel={() => setAdding(false)} />
        </div>
      )}
    </div>
  );
}
