"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/lib/auth-context";
import { CartProvider } from "@/lib/cart-context";
import { CheckoutProvider } from "@/lib/checkout-context";
import { OrdersProvider } from "@/lib/orders-context";
import { FavoritesProvider } from "@/lib/favorites-context";
import { CardsProvider } from "@/lib/cards-context";

/**
 * Scoped storefront provider stack for the appearance full-site preview.
 *
 * The root `Providers` component (`components/providers.tsx`) mounts only
 * `MotionConfig` + `ThemeProvider` on every `/admin` route, so transitioning
 * between `/admin/appearance` and `/admin/appearance/preview` does not remount
 * the shared provider tree. The preview page reuses real storefront components
 * (`SiteHeader`, `ProductEntry`, `SiteFooter`) that depend on the auth/cart
 * contexts, so it wraps them in this scoped shell — mounted inside the page,
 * not at the root.
 *
 * The preview is still admin-gated by its own page guard (session + role +
 * preview cookie); these providers are presentational plumbing, not an
 * authorization boundary.
 */
export function AppearancePreviewShell({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <CartProvider>
        <CheckoutProvider>
          <OrdersProvider>
            <FavoritesProvider>
              <CardsProvider>{children}</CardsProvider>
            </FavoritesProvider>
          </OrdersProvider>
        </CheckoutProvider>
      </CartProvider>
    </AuthProvider>
  );
}
