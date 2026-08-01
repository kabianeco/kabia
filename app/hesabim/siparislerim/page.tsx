"use client";

import Link from "next/link";
import Image from "next/image";
import { useOrders } from "@/lib/orders-context";
import { formatTL } from "@/lib/products";
import { OrderStatusBadge } from "@/components/account/order-status";
import { ButtonLink } from "@/components/ui/button";
import { routes } from "@/lib/site";

export default function OrdersListPage() {
  const { orders, hydrated } = useOrders();

  if (!hydrated) {
    return (
      <div className="min-h-[40vh]" aria-busy="true">
        <span className="sr-only">Siparişleriniz yükleniyor</span>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div>
        <h1 className="text-3xl tracking-tight md:text-4xl">Siparişlerim</h1>
        <p className="mt-8 max-w-sm text-base leading-relaxed text-ink/60">
          Henüz siparişiniz yok. İlk siparişinizi verdiğinizde burada takip
          edebilirsiniz.
        </p>
        <ButtonLink href={routes.store} className="mt-8">
          Mağazaya göz at
        </ButtonLink>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl tracking-tight md:text-4xl">Siparişlerim</h1>
      <ul className="mt-12 border-t border-ink/10">
        {orders.map((order) => (
          <li key={order.id} className="border-b border-ink/10">
            <Link
              href={`${routes.accountOrders}/${order.id}`}
              className="flex flex-wrap items-center gap-5 py-6 transition-colors duration-300 hover:bg-paper/60"
            >
              <span className="flex shrink-0 -space-x-4">
                {order.items.slice(0, 4).map((item, i) => (
                  <span
                    key={item.id}
                    style={{ zIndex: 10 - i }}
                    className="relative block h-11 w-11 overflow-hidden rounded-full bg-paper ring-2 ring-ivory"
                  >
                    <Image
                      src={item.image}
                      alt=""
                      fill
                      sizes="44px"
                      className="object-cover"
                    />
                  </span>
                ))}
                {order.items.length > 4 && (
                  <span className="figure relative z-0 flex h-11 w-11 items-center justify-center rounded-full bg-paper text-xs text-ink/60 ring-2 ring-ivory">
                    +{order.items.length - 4}
                  </span>
                )}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-3">
                  <span className="figure text-sm text-ink">{order.id}</span>
                  <OrderStatusBadge status={order.status} />
                </span>
                <span className="mt-1 block text-xs text-ink/50">
                  {new Date(order.date).toLocaleDateString("tr-TR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}{" "}
                  · {order.items.reduce((sum, i) => sum + i.quantity, 0)} ürün
                </span>
              </span>

              <span className="figure whitespace-nowrap text-base text-ink">
                {formatTL(order.total)}
              </span>
              <span aria-hidden="true" className="text-brand">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
