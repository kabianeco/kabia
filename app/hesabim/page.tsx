"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { useOrders } from "@/lib/orders-context";
import { useCheckout } from "@/lib/checkout-context";
import { useFavorites } from "@/lib/favorites-context";
import { formatTL } from "@/lib/products";
import { OrderStatusBadge } from "@/components/account/order-status";
import { ArrowLink } from "@/components/ui/button";
import { routes } from "@/lib/site";
import { useRecentlyViewed } from "@/lib/recently-viewed";
import { useHydrated } from "@/lib/use-hydrated";
import { fetchProducts } from "@/lib/catalog";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { type Product } from "@/lib/products";

function EmptyRecentlyViewed() {
  return (
    <div className="mt-8 border-t border-ink/10 pt-6">
      <p className="max-w-sm text-sm leading-relaxed text-ink/60">
        Henüz ürün incelemediniz. Baktığınız ürünler burada birikir, tekrar
        bulmanız kolay olur.
      </p>
      <div className="mt-4">
        <ArrowLink href={routes.store}>Mağazaya göz atın</ArrowLink>
      </div>
    </div>
  );
}

/**
 * The products this visitor opened most recently, newest first. Slugs come from
 * this device; the product records behind them come from the catalogue, so a
 * withdrawn product simply drops out of the row.
 */
function RecentlyViewed() {
  const slugs = useRecentlyViewed();
  const hydrated = useHydrated();
  const [catalogue, setCatalogue] = useState<Product[] | null>(null);

  useEffect(() => {
    let active = true;
    const supabase = createSupabaseBrowserClient();
    fetchProducts(supabase).then((all) => {
      if (active) setCatalogue(all);
    });
    return () => {
      active = false;
    };
  }, []);

  const products =
    catalogue === null
      ? null
      : slugs
          .map((slug) => catalogue.find((p) => p.slug === slug))
          .filter((p): p is Product => !!p)
          .slice(0, 4);

  // Nothing viewed yet: skip the catalogue wait and show the prompt directly.
  if (hydrated && slugs.length === 0) return <EmptyRecentlyViewed />;

  if (!hydrated || products === null) {
    return (
      <ul className="mt-8 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i}>
            <div className="aspect-square animate-pulse rounded-media bg-paper" />
            <div className="mt-3 h-4 w-3/4 animate-pulse bg-paper" />
          </li>
        ))}
      </ul>
    );
  }

  if (products.length === 0) return <EmptyRecentlyViewed />;

  return (
    <ul className="mt-8 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
      {products.map((product) => (
        <li key={product.id} className="group">
          <Link href={routes.product(product.slug)} className="block">
            <span className="relative block aspect-square overflow-hidden rounded-media bg-paper">
              {product.mainImageUrl && (
                <Image
                  src={product.mainImageUrl}
                  alt=""
                  fill
                  sizes="(min-width: 640px) 20vw, 45vw"
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                />
              )}
            </span>
            <span className="mt-3 block text-sm leading-snug transition-colors duration-300 group-hover:text-brand">
              {product.name}
            </span>
            <span className="figure mt-1 block text-sm text-ink/60">
              {formatTL(product.price)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function AccountOverviewPage() {
  const { user } = useAuth();
  const { orders } = useOrders();
  const { addresses } = useCheckout();
  const { favoriteSlugs } = useFavorites();

  const lastOrder = orders[0];
  const firstName = user?.name?.split(" ")[0] || "Merhaba";

  const stats = [
    { value: orders.length, label: "Sipariş" },
    { value: favoriteSlugs.length, label: "Favori" },
    { value: addresses.length, label: "Adres" },
  ];

  return (
    <div>
      <h1 className="text-3xl tracking-tight md:text-4xl">
        Merhaba, <em className="font-serif italic text-brand">{firstName}</em>.
      </h1>

      <dl className="mt-12 grid grid-cols-3 border-t border-ink/10">
        {stats.map((stat) => (
          <div key={stat.label} className="border-b border-ink/10 py-6 pr-4">
            <dd className="figure text-4xl text-ink">{stat.value}</dd>
            <dt className="label mt-2 text-olive">{stat.label}</dt>
          </div>
        ))}
      </dl>

      <section aria-labelledby="last-order" className="mt-14">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="last-order" className="text-2xl tracking-tight">
            Son siparişiniz
          </h2>
          {orders.length > 0 && (
            <ArrowLink href={routes.accountOrders}>Tümü</ArrowLink>
          )}
        </div>

        {lastOrder ? (
          <Link
            href={`${routes.accountOrders}/${lastOrder.id}`}
            className="mt-6 flex flex-wrap items-center gap-5 border-y border-ink/10 py-6 transition-colors duration-300 hover:bg-paper/60"
          >
            <span className="flex shrink-0 -space-x-4">
              {lastOrder.items.slice(0, 4).map((item, i) => (
                <span
                  key={item.id}
                  /* Circular and overlapping, first item on top, so a
                     multi-item order reads as a single stack. */
                  style={{ zIndex: 10 - i }}
                  className="relative block h-12 w-12 overflow-hidden rounded-full bg-paper ring-2 ring-ivory"
                >
                  <Image
                    src={item.image}
                    alt=""
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                </span>
              ))}
              {lastOrder.items.length > 4 && (
                <span className="figure relative z-0 flex h-12 w-12 items-center justify-center rounded-full bg-paper text-xs text-ink/60 ring-2 ring-ivory">
                  +{lastOrder.items.length - 4}
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="figure block text-sm text-ink">
                {lastOrder.id}
              </span>
              <span className="mt-1 block text-xs text-ink/50">
                {new Date(lastOrder.date).toLocaleDateString("tr-TR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </span>
            <OrderStatusBadge status={lastOrder.status} />
            <span className="figure whitespace-nowrap text-base text-ink">
              {formatTL(lastOrder.total)}
            </span>
          </Link>
        ) : (
          <div className="mt-6 border-t border-ink/10 pt-6">
            <p className="text-sm text-ink/60">Henüz siparişiniz yok.</p>
            <div className="mt-4">
              <ArrowLink href={routes.store}>Mağazaya göz atın</ArrowLink>
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="recently-viewed" className="mt-14">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="recently-viewed" className="text-2xl tracking-tight">
            Son baktıklarınız
          </h2>
          <ArrowLink href={routes.store}>Mağaza</ArrowLink>
        </div>
        <RecentlyViewed />
      </section>

    </div>
  );
}
