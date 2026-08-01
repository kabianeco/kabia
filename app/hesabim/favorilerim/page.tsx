"use client";

import { useEffect, useState } from "react";
import { useFavorites } from "@/lib/favorites-context";
import { fetchProducts } from "@/lib/catalog";
import { type Product } from "@/lib/products";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ProductEntry } from "@/components/shop/product-entry";
import { ButtonLink } from "@/components/ui/button";
import { routes } from "@/lib/site";

export default function FavoritesPage() {
  const { favoriteSlugs, hydrated } = useFavorites();
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const supabase = createSupabaseBrowserClient();
    fetchProducts(supabase).then((list) => {
      if (!active) return;
      setAllProducts(list);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!hydrated || loading) {
    return (
      <div className="min-h-[40vh]" aria-busy="true">
        <span className="sr-only">Favorileriniz yükleniyor</span>
      </div>
    );
  }

  const favoriteProducts = allProducts.filter((p) =>
    favoriteSlugs.includes(p.slug),
  );

  if (favoriteProducts.length === 0) {
    return (
      <div>
        <h1 className="text-3xl tracking-tight md:text-4xl">Favorilerim</h1>
        <p className="mt-8 max-w-sm text-base leading-relaxed text-ink/60">
          Henüz favoriniz yok. Ürün sayfasındaki kalp simgesine dokunarak
          buraya ekleyebilirsiniz.
        </p>
        <ButtonLink href={routes.store} className="mt-8">
          Mağazaya göz at
        </ButtonLink>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl tracking-tight md:text-4xl">Favorilerim</h1>
      <ul className="mt-12 grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2">
        {favoriteProducts.map((product) => (
          <ProductEntry key={product.id} product={product} />
        ))}
      </ul>
    </div>
  );
}
