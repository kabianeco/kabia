"use client";

import Image from "next/image";
import { ButtonLink } from "@/components/ui/button";
import { formatTL } from "@/lib/products";
import type { CartItem } from "@/lib/cart-context";
import type { SavedAddress } from "@/lib/checkout-context";
import { routes } from "@/lib/site";

export function ConfirmationStep({
  orderNumber,
  deliveryDate,
  items,
  total,
  email,
  address,
}: {
  orderNumber: string;
  deliveryDate: string;
  items: CartItem[];
  total: number;
  email: string;
  address: SavedAddress;
}) {
  return (
    <section aria-labelledby="confirmation-heading">
      <p className="label text-brand">Sipariş alındı</p>
      <h1
        id="confirmation-heading"
        className="mt-6 text-4xl leading-[1.1] tracking-tight md:text-5xl"
      >
        Teşekkürler. <em className="font-serif italic text-brand">Yola çıkıyor.</em>
      </h1>
      <p className="mt-6 max-w-md text-base leading-relaxed text-ink/65">
        {email
          ? `Sipariş özetini ${email} adresine gönderdik.`
          : "Siparişiniz oluşturuldu."}
      </p>

      <dl className="mt-12 grid gap-x-8 gap-y-6 border-t border-ink/10 pt-8 sm:grid-cols-2">
        <div>
          <dt className="label text-olive">Sipariş numarası</dt>
          <dd className="figure mt-2 text-lg text-ink">{orderNumber || "—"}</dd>
        </div>
        <div>
          <dt className="label text-olive">Tahmini teslimat</dt>
          <dd className="mt-2 text-sm text-ink">{deliveryDate}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="label text-olive">Teslimat adresi</dt>
          <dd className="mt-2 text-sm leading-relaxed text-ink/70">
            {address.recipientName} · {address.phone}
            <br />
            {address.addressLine1}
            {address.addressLine2 && `, ${address.addressLine2}`}
            <br />
            {address.district} / {address.city} {address.postalCode}
          </dd>
        </div>
      </dl>

      <section aria-labelledby="ordered-items" className="mt-12">
        <h2 id="ordered-items" className="label text-olive">
          Ürünler
        </h2>
        <ul className="mt-4 border-t border-ink/10">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-4 border-b border-ink/10 py-4"
            >
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
        <p className="mt-5 flex items-baseline justify-between">
          <span className="text-base text-ink">Toplam</span>
          <span className="figure text-xl text-ink">{formatTL(total)}</span>
        </p>
      </section>

      <div className="mt-12 flex flex-wrap items-center gap-7">
        <ButtonLink href={routes.accountOrders} size="lg">
          Siparişlerim
        </ButtonLink>
        <ButtonLink href={routes.store} variant="ghost">
          Alışverişe devam et
        </ButtonLink>
      </div>
    </section>
  );
}
