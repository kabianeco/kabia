"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/field";
import { formatTL } from "@/lib/products";
import { routes } from "@/lib/site";
import type { CartItem } from "@/lib/cart-context";
import type { SavedAddress } from "@/lib/checkout-context";
import { maskedCardNumber } from "./validation";
import type { PaymentData } from "./types";

function Block({
  title,
  onEdit,
  editLabel,
  children,
}: {
  title: string;
  onEdit: () => void;
  editLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-ink/10 py-7">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="label text-olive">{title}</h2>
        <button
          type="button"
          onClick={onEdit}
          className="min-h-11 text-sm text-brand transition-colors hover:text-forest"
        >
          {editLabel}
        </button>
      </div>
      <div className="mt-4 text-sm leading-relaxed text-ink/70">{children}</div>
    </section>
  );
}

export function ReviewStep({
  items,
  subtotal,
  shippingCost,
  total,
  fullName,
  email,
  address,
  payment,
  onEditAddress,
  onEditPayment,
  onBack,
  onConfirm,
  submitting,
  agreedSales,
  agreedKvkk,
  onAgreedSalesChange,
  onAgreedKvkkChange,
}: {
  items: CartItem[];
  subtotal: number;
  shippingCost: number;
  total: number;
  fullName: string;
  email: string;
  address: SavedAddress;
  payment: PaymentData;
  onEditAddress: () => void;
  onEditPayment: () => void;
  onBack: () => void;
  onConfirm: () => void;
  submitting: boolean;
  agreedSales: boolean;
  agreedKvkk: boolean;
  onAgreedSalesChange: (v: boolean) => void;
  onAgreedKvkkChange: (v: boolean) => void;
}) {
  const [touched, setTouched] = useState(false);
  const showError = touched && (!agreedSales || !agreedKvkk);
  return (
    <section aria-labelledby="review-heading">
      <h1 id="review-heading" className="text-3xl tracking-tight md:text-4xl">
        Siparişinizi kontrol edin
      </h1>

      <Block title="Teslimat" onEdit={onEditAddress} editLabel="Değiştir">
        <p>
          {fullName || address.recipientName} · {address.phone}
          <br />
          {address.addressLine1}
          {address.addressLine2 && `, ${address.addressLine2}`}
          <br />
          {address.district} / {address.city} {address.postalCode}
        </p>
        {email && <p className="mt-2 text-ink/50">{email}</p>}
      </Block>

      <Block title="Ödeme" onEdit={onEditPayment} editLabel="Değiştir">
        {payment.method === "cod" ? (
          <p>Kapıda ödeme</p>
        ) : (
          <p>
            <span className="figure">{maskedCardNumber(payment.cardNumber)}</span>
            <br />
            {payment.cardName}
          </p>
        )}
      </Block>

      <section className="border-t border-ink/10 py-7">
        <h2 className="label text-olive">Ürünler</h2>
        <ul className="mt-4">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-4 py-3">
              <span className="relative aspect-square w-14 shrink-0 overflow-hidden rounded-media bg-paper">
                <Image
                  src={item.image}
                  alt=""
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink">
                  {item.name}
                </span>
                <span className="mt-0.5 block text-xs text-ink/50">
                  {item.variant} · {item.quantity} adet
                </span>
              </span>
              <span className="figure text-sm text-ink">
                {formatTL(item.price * item.quantity)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <dl className="space-y-3 border-t border-ink/10 py-7 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink/60">Ara toplam</dt>
          <dd className="figure text-ink">{formatTL(subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink/60">Kargo</dt>
          <dd className="figure text-ink">
            {shippingCost === 0 ? "Ücretsiz" : formatTL(shippingCost)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between border-t border-ink/15 pt-4">
          <dt className="text-base text-ink">Toplam</dt>
          <dd className="figure text-2xl text-ink">{formatTL(total)}</dd>
        </div>
      </dl>

      {/* Yasal onay kutuları — sipariş için zorunlu (Trendyol/Hepsiburada benzeri) */}
      <div className="mt-8 rounded-theme-card border border-ink/10 bg-paper p-5">
        <h2 className="label text-olive">Onaylar</h2>
        <div className="mt-4 space-y-4">
          <Checkbox
            label={
              <span className="text-sm leading-relaxed">
                <Link href={routes.distanceSalesAgreement} target="_blank" className="font-medium text-brand hover:text-forest underline underline-offset-4">
                  Mesafeli Satış Sözleşmesi
                </Link>
                ,{" "}
                <Link href={routes.preliminaryInfo} target="_blank" className="font-medium text-brand hover:text-forest underline underline-offset-4">
                  Ön Bilgilendirme Formu
                </Link>{" "}
                ve{" "}
                <Link href={routes.deliveryAndReturn} target="_blank" className="font-medium text-brand hover:text-forest underline underline-offset-4">
                  Teslimat ve İade Koşulları
                </Link>
                ’nı okudum, onaylıyorum. <span className="text-clay">*</span>
              </span>
            }
            checked={agreedSales}
            onChange={(e) => onAgreedSalesChange(e.target.checked)}
            aria-invalid={showError && !agreedSales ? true : undefined}
          />
          <Checkbox
            label={
              <span className="text-sm leading-relaxed">
                <Link href={routes.kvkkDisclosure} target="_blank" className="font-medium text-brand hover:text-forest underline underline-offset-4">
                  KVKK Aydınlatma Metni
                </Link>{" "}
                ve{" "}
                <Link href={routes.privacyPolicy} target="_blank" className="font-medium text-brand hover:text-forest underline underline-offset-4">
                  Gizlilik Politikası
                </Link>
                ’nı okudum, kişisel verilerimin siparişin yerine getirilmesi amacıyla işlenmesini onaylıyorum.{" "}
                <span className="text-clay">*</span>
              </span>
            }
            checked={agreedKvkk}
            onChange={(e) => onAgreedKvkkChange(e.target.checked)}
            aria-invalid={showError && !agreedKvkk ? true : undefined}
          />
          {showError && (
            <p role="alert" className="text-xs text-clay">
              Siparişi onaylamak için sözleşmeleri onaylamanız gerekiyor.
            </p>
          )}
          <p className="text-xs leading-relaxed text-ink/45">
            Siparişi onayladığınızda 14 gün cayma hakkınızın istisnalarını (ambalajı açılmış gıda) kabul etmiş sayılırsınız. Detaylar{" "}
            <Link href={routes.deliveryAndReturn} target="_blank" className="underline underline-offset-4">
              Teslimat ve İade
            </Link>{" "}
            sayfasında.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-7">
        <Button
          size="lg"
          onClick={() => {
            if (!agreedSales || !agreedKvkk) {
              setTouched(true);
              return;
            }
            onConfirm();
          }}
          disabled={submitting}
        >
          {submitting ? "Sipariş oluşturuluyor…" : "Siparişi onayla"}
        </Button>
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="min-h-11 text-sm text-ink/55 transition-colors hover:text-ink disabled:opacity-50"
        >
          Geri
        </button>
      </div>
    </section>
  );
}
