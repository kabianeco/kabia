"use client";

import { useEffect, useState } from "react";
import { useFavorites } from "@/lib/favorites-context";
import { fetchPublicProducts } from "@/lib/catalog";
import { type Product } from "@/lib/products";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { ProductEntry } from "@/components/shop/product-entry";
import { AccountEmpty, AccountError, AccountHeading, AccountLoading } from "@/components/account/account-states";
import { routes } from "@/lib/site";

export default function FavoritesPage() {
  const { favoriteSlugs, hydrated, error: favoritesError } = useFavorites();
  // undefined = loading, null = catalogue read failed.
  const [catalogue, setCatalogue] = useState<Product[] | null | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      const supabase = await getSupabaseBrowserClient();
      const result = await fetchPublicProducts(supabase);
      if (active) setCatalogue(result.status === "ok" ? result.products : null);
    })();
    return () => {
      active = false;
    };
  }, [attempt]);

  const retry = () => {
    setCatalogue(undefined);
    setAttempt((n) => n + 1);
  };

  const favoriteProducts = catalogue ? catalogue.filter((p) => favoriteSlugs.includes(p.slug)) : [];

  return (
    <div>
      <AccountHeading title="Favorilerim" />
      {!hydrated || catalogue === undefined ? (
        <AccountLoading label="Favorileriniz yükleniyor" rows={2} />
      ) : favoritesError || catalogue === null ? (
        <AccountError message="Favorileriniz şu anda yüklenemedi." onRetry={favoritesError ? () => window.location.reload() : retry} />
      ) : favoriteProducts.length === 0 ? (
        <AccountEmpty action={{ href: routes.store, label: "Mağazaya göz atın" }}>
          Henüz favoriniz yok. Ürün sayfasındaki kalp simgesiyle buraya ekleyebilirsiniz.
        </AccountEmpty>
      ) : (
        <ul className="mt-12 grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2">
          {favoriteProducts.map((product) => (
            <ProductEntry key={product.id} product={product} />
          ))}
        </ul>
      )}
    </div>
  );
}
