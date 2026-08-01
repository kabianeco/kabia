"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useOrders, type OrderRecord } from "@/lib/orders-context";
import { useCart } from "@/lib/cart-context";
import { formatTL } from "@/lib/products";
import {
  OrderStatusBadge,
  OrderStatusTimeline,
} from "@/components/account/order-status";
import { routes } from "@/lib/site";

export default function OrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const { fetchOrder, hydrated } = useOrders();
  const { addItem } = useCart();
  const [order, setOrder] = useState<OrderRecord | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    fetchOrder(params.orderId).then((o) => {
      if (active) setOrder(o ?? null);
    });
    return () => {
      active = false;
    };
  }, [params.orderId, fetchOrder]);

  if (!hydrated || order === undefined) {
    return (
      <div className="min-h-[40vh]" aria-busy="true">
        <span className="sr-only">Sipariş yükleniyor</span>
      </div>
    );
  }

  if (!order) {
    return (
      <div>
        <h1 className="text-3xl tracking-tight md:text-4xl">
          Sipariş bulunamadı
        </h1>
        <p className="mt-6 max-w-sm text-base leading-relaxed text-ink/60">
          Bu sipariş numarası hesabınıza ait değil ya da kaldırılmış olabilir.
        </p>
        <Link
          href={routes.accountOrders}
          className="mt-8 inline-flex min-h-11 items-center text-sm text-brand transition-colors hover:text-forest"
        >
          ← Siparişlerime dön
        </Link>
      </div>
    );
  }

  const handleReorder = () => {
    // Items whose product or variant has since been removed can no longer be
    // added back to the cart — the cart is keyed on live database ids.
    const reorderable = order.items.filter(
      (i): i is typeof i & { variantId: string; productId: string } =>
        !!i.variantId && !!i.productId,
    );
    if (reorderable.length === 0) {
      toast.error("Bu siparişteki ürünler artık satışta değil.");
      return;
    }
    reorderable.forEach((item) => addItem(item));
    toast.success("Ürünler sepete eklendi.", {
      action: {
        label: "Sepete git",
        onClick: () => (window.location.href = routes.cart),
      },
    });
  };

  return (
    <div>
      <Link
        href={routes.accountOrders}
        className="inline-flex min-h-11 items-center text-sm text-ink/55 transition-colors hover:text-ink"
      >
        ← Siparişlerime dön
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <h1 className="figure text-3xl tracking-tight md:text-4xl">{order.id}</h1>
        <OrderStatusBadge status={order.status} />
      </div>
      <p className="mt-2 text-sm text-ink/50">
        {new Date(order.date).toLocaleDateString("tr-TR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </p>

      <div className="mt-12">
        <OrderStatusTimeline status={order.status} />
      </div>

      <section aria-labelledby="order-items" className="mt-14">
        <h2 id="order-items" className="label text-olive">
          Ürünler
        </h2>
        <ul className="mt-4 border-t border-ink/10">
          {order.items.map((item) => (
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
      </section>

      <div className="mt-12 grid gap-10 sm:grid-cols-2">
        <div>
          <h2 className="label text-olive">Teslimat adresi</h2>
          <p className="mt-3 text-sm leading-relaxed text-ink/70">
            {order.fullName}
            <br />
            {order.address.addressLine1}
            {order.address.addressLine2 && <>, {order.address.addressLine2}</>}
            <br />
            {order.address.district} / {order.address.city}{" "}
            {order.address.postalCode}
          </p>
        </div>
        <div>
          <h2 className="label text-olive">Ödeme yöntemi</h2>
          <p className="mt-3 text-sm text-ink/70">{order.paymentLabel || "—"}</p>
        </div>
      </div>

      <dl className="ml-auto mt-12 max-w-sm space-y-3 border-t border-ink/10 pt-6 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink/60">Ara toplam</dt>
          <dd className="figure text-ink">{formatTL(order.subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink/60">Kargo</dt>
          <dd className="figure text-ink">
            {order.shippingCost === 0 ? "Ücretsiz" : formatTL(order.shippingCost)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between border-t border-ink/15 pt-4">
          <dt className="text-base text-ink">Toplam</dt>
          <dd className="figure text-xl text-ink">{formatTL(order.total)}</dd>
        </div>
      </dl>

      <div className="mt-10">
        <Button onClick={handleReorder} size="lg">
          Tekrar sipariş ver
        </Button>
      </div>
    </div>
  );
}
