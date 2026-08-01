"use client";

import { MotionConfig } from "framer-motion";
import { Toaster } from "sonner";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/lib/theme";
import { AuthProvider } from "@/lib/auth-context";
import { CartProvider } from "@/lib/cart-context";
import { CheckoutProvider } from "@/lib/checkout-context";
import { OrdersProvider } from "@/lib/orders-context";
import { FavoritesProvider } from "@/lib/favorites-context";
import { CardsProvider } from "@/lib/cards-context";

/**
 * The application's single provider stack, mounted once in the root layout.
 *
 * Order matters: everything below AuthProvider reads the Supabase session from
 * it to decide whether to read/write the database or fall back to guest
 * localStorage. `children` arrives as a prop from the server layout, so state
 * changes in any provider re-render only the components that consume them —
 * the Three.js scene on the homepage is never remounted by a cart or auth
 * update.
 *
 * reducedMotion="user" is the single Framer Motion boundary for the whole app.
 */
export function Providers({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // The admin dashboard is a server-rendered surface: it reads through the
  // administrator's own cookie-bound session on the server and does not use the
  // storefront's cart, checkout, orders, favorites or cards contexts. Mounting
  // them there would fire a handful of client queries on every admin page for
  // no consumer. The theme still applies — the dashboard uses the same tokens.
  if (pathname.startsWith("/admin")) {
    return (
      <MotionConfig reducedMotion="user">
        <ThemeProvider>{children}</ThemeProvider>
        <SiteToaster />
      </MotionConfig>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <ThemeProvider>
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
      </ThemeProvider>
      <SiteToaster />
    </MotionConfig>
  );
}

/** Sonner, dressed in the site's palette. Shared by both branches above. */
function SiteToaster() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: "var(--color-ivory)",
          color: "var(--color-ink)",
          border:
            "1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)",
          boxShadow: "none",
        },
      }}
    />
  );
}
