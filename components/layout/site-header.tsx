"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, ShoppingBag, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { anchors, homeAnchor, routes } from "@/lib/site";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const sectionItems = [
  { label: "Çiftlik", anchor: anchors.farm },
  { label: "Yaklaşım", anchor: anchors.approach },
  { label: "İletişim", anchor: anchors.contact },
];

export function SiteHeader({ bannerOffset = false }: { bannerOffset?: boolean }) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const { isLoggedIn, hydrated: authHydrated, logout } = useAuth();
  const { itemCount, hydrated: cartHydrated } = useCart();

  const [scrolled, setScrolled] = useState(false);
  // The menu remembers the route it was opened on, so any navigation closes it
  // by derivation — no effect needed to reset it.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const close = useCallback((restoreFocus = true) => {
    setOpenedOn(null);
    if (restoreFocus) toggleRef.current?.focus();
  }, []);

  // Escape closes the menu; focus is trapped inside the panel while it is open.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>("a, button")?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key === "Tab" && panel) {
        const focusables = [
          toggleRef.current,
          ...panel.querySelectorAll<HTMLElement>("a, button"),
        ].filter(Boolean) as HTMLElement[];
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, close]);

  // Off the homepage the header always sits on a surface: there is no hero
  // behind it for it to be transparent over.
  const surfaced = scrolled || open || !isHome;

  // Anchors resolve only on the homepage, so prefix them everywhere else.
  const sectionHref = (anchor: string) => (isHome ? anchor : homeAnchor(anchor));

  const accountHref = isLoggedIn ? routes.account : routes.login;
  // Used as the icon's accessible name; resolves once auth has hydrated.
  const accountLabel = authHydrated && isLoggedIn ? "Hesabım" : "Giriş yap";
  const showCount = cartHydrated && itemCount > 0;
  const cartLabel = showCount ? `Sepet — ${itemCount} ürün` : "Sepet";

  const cartBadge = showCount && (
    <span
      aria-hidden="true"
      className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-medium text-on-brand"
    >
      {itemCount > 99 ? "99+" : itemCount}
    </span>
  );

  return (
    <header
      className={cn(
        "site-header fixed inset-x-0 z-40",
        bannerOffset ? "top-10" : "top-0",
        surfaced
          ? "border-b border-ink/10 bg-ivory/95 backdrop-blur-sm"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="wrap flex h-16 items-center justify-between md:h-20">
        <Link
          href={routes.home}
          aria-label="Kabia Ekolojik — anasayfa"
          onClick={() => close(false)}
        >
          <Image
            src="/images/logo.svg"
            alt="Kabia Ekolojik"
            width={177}
            height={60}
            priority
            className="h-7 w-auto md:h-8"
          />
        </Link>

        <nav aria-label="Ana menü" className="hidden items-center gap-8 md:flex">
          <Link
            href={routes.store}
            aria-current={pathname.startsWith(routes.store) ? "page" : undefined}
            className={`text-sm transition-colors duration-300 hover:text-ink ${
              pathname.startsWith(routes.store) ? "text-ink" : "text-ink/70"
            }`}
          >
            Mağaza
          </Link>
          {sectionItems.map((item) => (
            <a
              key={item.anchor}
              href={sectionHref(item.anchor)}
              className="text-sm text-ink/70 transition-colors duration-300 hover:text-ink"
            >
              {item.label}
            </a>
          ))}

          <span className="flex items-center gap-1">
            <ThemeToggle />

            <Link
              href={routes.cart}
              aria-label={cartLabel}
              aria-current={pathname === routes.cart ? "page" : undefined}
              className="relative flex h-11 w-11 items-center justify-center text-ink/70 transition-colors duration-300 hover:text-ink"
            >
              <ShoppingBag className="h-5 w-5" aria-hidden="true" />
              {cartBadge}
            </Link>

            <Link
              href={accountHref}
              aria-label={accountLabel}
              aria-current={pathname.startsWith(routes.account) ? "page" : undefined}
              className="flex h-11 w-11 items-center justify-center text-ink/70 transition-colors duration-300 hover:text-ink"
            >
              <User className="h-5 w-5" aria-hidden="true" />
            </Link>
          </span>
        </nav>

        <div className="flex items-center md:hidden">
          <ThemeToggle />

          <Link
            href={routes.cart}
            aria-label={cartLabel}
            onClick={() => close(false)}
            className="relative flex h-11 w-11 items-center justify-center text-ink"
          >
            <ShoppingBag className="h-5 w-5" aria-hidden="true" />
            {cartBadge}
          </Link>

          <button
            ref={toggleRef}
            type="button"
            className="flex h-11 w-11 items-center justify-center text-ink"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Menüyü kapat" : "Menüyü aç"}
            onClick={() => (open ? close() : setOpenedOn(pathname))}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div
          id="mobile-menu"
          ref={panelRef}
          className="fixed inset-x-0 bottom-0 top-16 overflow-y-auto border-t border-ink/10 bg-ivory px-6 py-10 md:hidden"
        >
          <nav aria-label="Mobil menü" className="flex flex-col">
            <Link
              href={routes.store}
              onClick={() => close(false)}
              className="flex items-baseline justify-between border-b border-ink/10 py-4 font-serif text-2xl"
            >
              Mağaza
            </Link>
            {sectionItems.map((item) => (
              <a
                key={item.anchor}
                href={sectionHref(item.anchor)}
                onClick={() => close(false)}
                className="flex items-baseline justify-between border-b border-ink/10 py-4 font-serif text-2xl"
              >
                {item.label}
              </a>
            ))}
            <Link
              href={routes.cart}
              onClick={() => close(false)}
              className="flex items-baseline justify-between border-b border-ink/10 py-4 font-serif text-2xl"
            >
              Sepet
              {showCount && (
                <span className="label text-olive">{itemCount} ürün</span>
              )}
            </Link>
            <Link
              href={accountHref}
              onClick={() => close(false)}
              className="flex items-baseline justify-between border-b border-ink/10 py-4 font-serif text-2xl"
            >
              {accountLabel}
            </Link>
          </nav>

          {authHydrated && isLoggedIn && (
            <button
              type="button"
              onClick={() => {
                close(false);
                logout();
              }}
              className="mt-8 min-h-11 text-sm text-ink/60 transition-colors duration-300 hover:text-ink"
            >
              Çıkış yap
            </button>
          )}
        </div>
      )}
    </header>
  );
}
