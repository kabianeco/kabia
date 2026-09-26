"use client";

import Link from "next/link";
import Image from "next/image";
import { useOrders } from "@/lib/orders-context";
import { formatTL } from "@/lib/products";
import { OrderStatusBadge } from "@/components/account/order-status";
import { AccountEmpty, AccountError, AccountHeading, AccountLoading } from "@/components/account/account-states";
import { routes } from "@/lib/site";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
}

export default function OrdersListPage() {
  const { orders, hydrated, error, refresh } = useOrders();

  return (
    <div>
      <AccountHeading title="Siparişlerim" />

      {!hydrated ? (
        <AccountLoading label="Siparişleriniz yükleniyor" />
      ) : error ? (
        <AccountError message="Siparişleriniz şu anda yüklenemedi." onRetry={() => void refresh()} />
      ) : orders.length === 0 ? (
        <AccountEmpty action={{ href: routes.store, label: "Mağazaya göz atın" }}>
          Henüz siparişiniz yok. İlk siparişinizi verdiğinizde burada takip edebilirsiniz.
        </AccountEmpty>
      ) : (
        <ul className="mt-12 border-t border-ink/10">
          {orders.map((order) => (
            <li key={order.id} className="border-b border-ink/10">
              <Link
                href={`${routes.accountOrders}/${order.id}`}
                className="flex items-center gap-4 py-6 transition-colors duration-300 hover:bg-paper/60 sm:gap-5"
              >
                <span className="hidden shrink-0 -space-x-4 sm:flex">
                  {order.items.slice(0, 4).map((item, i) => (
                    <span
                      key={item.id}
                      style={{ zIndex: 10 - i }}
                      className="relative block h-11 w-11 overflow-hidden rounded-full bg-paper ring-2 ring-ivory"
                    >
                      <Image src={item.image} alt="" fill sizes="44px" className="object-cover" />
                    </span>
                  ))}
                  {order.items.length > 4 && (
                    <span className="figure relative z-0 flex h-11 w-11 items-center justify-center rounded-full bg-paper text-xs text-ink/60 ring-2 ring-ivory">
                      +{order.items.length - 4}
                    </span>
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="figure text-sm text-ink">{order.id}</span>
                    <OrderStatusBadge status={order.status} />
                  </span>
                  <span className="mt-1 block text-xs text-ink/50">
                    {formatDate(order.date)} · {order.items.reduce((sum, i) => sum + i.quantity, 0)} ürün
                  </span>
                </span>

                <span className="figure whitespace-nowrap text-base text-ink">{formatTL(order.total)}</span>
                <span aria-hidden="true" className="text-brand">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
