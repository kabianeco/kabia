"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, ShoppingBag, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { routes } from "@/lib/site";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import { ThemeToggle } from "@/components/ui/theme-toggle";

/* The farm anchor is deliberately absent: /ciftlik now carries the farm story
   in full, and the homepage section is only its short introduction, so keeping
   both would put two links labelled "Çiftlik" in the same nav. */
const sectionItems = [{ label: "İletişim", href: routes.contact }];

/* Mobile index groupings. Primary is where Kabia lives (shop, farm, the
   people behind the selection); account keeps commerce and contact at hand.
   The cart icon also remains in the bar itself. */
const mobilePrimary = [
  { label: "Çiftlik", href: routes.farm },
  { label: "Seçki", href: routes.secki },
  { label: "Mutfak", href: routes.mutfak },
  { label: "Üreticiler", href: routes.producers },
  { label: "Mağaza", href: routes.store },
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
  // The menu is one full-screen piece, bar included: a single opaque
  // curtain reveals it top to bottom, and the rows are uncovered by that
  // same sweep — no second, staggered animation on top of it. Reduced-motion
  // visitors get the same destinations with no movement at all.
  //
  // The motion is plain CSS (app/globals.css, .menu-curtain-* and
  // .menu-icon-*), so the header ships no animation library.
  const reducedMotion = usePrefersReducedMotion();
  // Focus returns to the header toggle only after the curtain has lifted,
  // so it never lands on an element hidden behind the overlay mid-exit.
  const focusOnCloseRef = useRef(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const close = useCallback((restoreFocus = true) => {
    focusOnCloseRef.current = restoreFocus;
    setOpenedOn(null);
  }, []);

  const handleExitComplete = useCallback(() => {
    if (focusOnCloseRef.current) {
      focusOnCloseRef.current = false;
      toggleRef.current?.focus();
    }
  }, []);

  // The panel stays mounted through its exit sweep, so the curtain lifts
  // before it goes; focus returns once it has gone. Reduced motion: no sweep.
  const [panelShown, setPanelShown] = useState(false);
  if (open && !panelShown) setPanelShown(true);
  if (!open && panelShown && reducedMotion) setPanelShown(false);
  const panelExiting = panelShown && !open;
  const panelWasShown = useRef(false);
  useEffect(() => {
    if (panelWasShown.current && !panelShown) handleExitComplete();
    panelWasShown.current = panelShown;
  }, [panelShown, handleExitComplete]);

  // The toggle icon turns out, then the other turns in — one at a time.
  const iconTarget = open ? "kapat" : "ac";
  const [icon, setIcon] = useState<"ac" | "kapat">(iconTarget);
  const [iconPhase, setIconPhase] = useState<"idle" | "out" | "in">("idle");
  if (iconTarget !== icon && iconPhase === "idle") {
    if (reducedMotion) setIcon(iconTarget);
    else setIconPhase("out");
  }
  const onIconAnimationEnd = () => {
    if (iconPhase === "out") {
      setIcon(iconTarget);
      setIconPhase("in");
    } else if (iconPhase === "in") {
      setIconPhase("idle");
    }
  };

  // Escape closes the menu; focus is trapped inside the overlay while open.
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
        // The bar starts at top: 0 and draws under the status bar
        // (viewport-fit=cover in app/layout.tsx). The inset is applied
        // exactly once in the stack: with the announcement band the band
        // already carries it, so the header only offsets below the band;
        // without the band the header pads itself clear of the notch.
        "site-header fixed inset-x-0 z-40",
        bannerOffset
          ? "top-[calc(2.5rem+var(--safe-top))]"
          : "top-0 pt-[var(--safe-top)]",
        // While the menu is open the header carries its own surface and stays
        // in frame even over the intro film (see .site-header--menu-open in
        // globals.css) — the open index is a destination, not a hidden panel.
        // Deliberately solid, never blurred: backdrop-filter would turn the
        // header into the containing block for the fixed overlay and shrink
        // the full-screen curtain to the bar's own 64px.
        open && "site-header--menu-open",
        open
          ? "border-b border-ink/10 bg-ivory"
          : surfaced
            ? "border-b border-ink/10 bg-ivory/95 backdrop-blur-sm"
            // Floating with no ground of its own means floating over the
            // intro's footage, which is dark. The ink palette used everywhere
            // else is invisible there, so the header borrows the light one
            // (see .site-header--over-film in globals.css).
            : "site-header--over-film border-b border-transparent bg-transparent",
      )}
    >
      <div className="wrap flex h-16 items-center justify-between lg:h-20">
        <Link
          href={routes.home}
          prefetch={false}
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

        {/* Full navigation earns its horizontal space: at tablet widths the
            five links plus commerce icons crowd the measure, so tablet gets
            the editorial index instead of a squeezed desktop row. */}
        <nav aria-label="Ana menü" className="hidden items-center gap-8 lg:flex">
          <Link
            href={routes.farm}
            prefetch={false}
            aria-current={pathname.startsWith(routes.farm) ? "page" : undefined}
            className={`text-sm transition-colors duration-300 hover:text-ink ${
              pathname.startsWith(routes.farm) ? "text-ink" : "text-ink/70"
            }`}
          >
            Çiftlik
          </Link>
          <Link
            href={routes.secki}
            prefetch={false}
            aria-current={pathname.startsWith(routes.secki) ? "page" : undefined}
            className={`text-sm transition-colors duration-300 hover:text-ink ${
              pathname.startsWith(routes.secki) ? "text-ink" : "text-ink/70"
            }`}
          >
            Seçki
          </Link>
          <Link
            href={routes.mutfak}
            prefetch={false}
            aria-current={pathname.startsWith(routes.mutfak) ? "page" : undefined}
            className={`text-sm transition-colors duration-300 hover:text-ink ${
              pathname.startsWith(routes.mutfak) ? "text-ink" : "text-ink/70"
            }`}
          >
            Mutfak
          </Link>

          {sectionItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm text-ink/70 transition-colors duration-300 hover:text-ink"
            >
              {item.label}
            </a>
          ))}

          <Link
            href={routes.store}
            prefetch={false}
            aria-current={pathname.startsWith(routes.store) ? "page" : undefined}
            className="inline-flex min-h-11 items-center rounded-full bg-brand px-5 text-sm font-medium text-on-brand transition-colors duration-300 hover:bg-forest"
          >
            Mağaza
          </Link>

          <span className="flex items-center gap-1">
            <ThemeToggle />

            <Link
              href={routes.cart}
              prefetch={false}
              aria-label={cartLabel}
              aria-current={pathname === routes.cart ? "page" : undefined}
              className="relative flex h-11 w-11 items-center justify-center text-ink/70 transition-colors duration-300 hover:text-ink"
            >
              <ShoppingBag className="h-5 w-5" aria-hidden="true" />
              {cartBadge}
            </Link>

            <Link
              href={accountHref}
              prefetch={false}
              aria-label={accountLabel}
              aria-current={pathname.startsWith(routes.account) ? "page" : undefined}
              className="flex h-11 w-11 items-center justify-center text-ink/70 transition-colors duration-300 hover:text-ink"
            >
              <User className="h-5 w-5" aria-hidden="true" />
            </Link>
          </span>
        </nav>

        <div className="flex items-center lg:hidden">
          <ThemeToggle />

          <Link
            href={routes.cart}
            prefetch={false}
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
            <span
              key={icon}
              className={cn(
                "flex",
                iconPhase === "out" && "menu-icon-out",
                iconPhase === "in" && "menu-icon-in",
              )}
              onAnimationEnd={onIconAnimationEnd}
              aria-hidden="true"
            >
              {icon === "kapat" ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </span>
          </button>
        </div>
      </div>

      {panelShown && (
        <div
          id="mobile-menu"
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Menü"
          onAnimationEnd={(e) => {
            if (e.target === e.currentTarget && panelExiting) setPanelShown(false);
          }}
          className={cn(
            // From the very top edge to the bottom (100dvh), with its own
            // padding so the bar row sits below the inset while the panel's
            // own background covers the status bar area completely.
            "fixed inset-x-0 top-0 z-50 flex h-[100dvh] flex-col bg-ivory pt-[var(--safe-top)] lg:hidden",
            !reducedMotion && (panelExiting ? "menu-curtain-out" : "menu-curtain-in"),
          )}
        >
          {/* The bar travels with the curtain: one piece from the very top,
              not a fixed bar with a second panel unfolding beneath it.
              w-full matters — as a flex item .wrap would shrink-wrap and
              pull the logo and icons toward the center. The panel's own
              padding already clears the notch, so the row adds none. */}
          <div className="wrap flex h-16 w-full shrink-0 items-center justify-between border-b border-ink/10">
            <Link
              href={routes.home}
              prefetch={false}
              aria-label="Kabia Ekolojik — anasayfa"
              onClick={() => close(false)}
            >
              <Image
                src="/images/logo.svg"
                alt="Kabia Ekolojik"
                width={177}
                height={60}
                className="h-7 w-auto"
              />
            </Link>

            <div className="flex items-center">
              <ThemeToggle />

              <Link
                href={routes.cart}
                prefetch={false}
                aria-label={cartLabel}
                onClick={() => close(false)}
                className="relative flex h-11 w-11 items-center justify-center text-ink"
              >
                <ShoppingBag className="h-5 w-5" aria-hidden="true" />
                {cartBadge}
              </Link>

              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center text-ink"
                aria-label="Menüyü kapat"
                onClick={() => close()}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* The index scrolls within the remaining viewport on short screens. */}
          <div className="flex-1 overflow-y-auto overscroll-contain pb-[max(2rem,var(--safe-bottom))]">
            <nav
              aria-label="Mobil menü"
              className="wrap flex max-h-none flex-col pb-2 pt-8"
            >
              <p className="label text-olive">Kabia</p>
              <ul>
                {mobilePrimary.map((item) => (
                  <li key={item.href} className="border-b border-ink/10">
                    <Link
                      href={item.href}
                      prefetch={false}
                      onClick={() => close(false)}
                      aria-current={
                        pathname.startsWith(item.href) ? "page" : undefined
                      }
                      className="flex min-h-11 items-baseline justify-between py-3.5 font-serif text-[1.7rem] leading-snug tracking-tight"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>

              <p className="label mt-8 text-olive">Hesap</p>
              <ul>
                <li className="border-b border-ink/10">
                  <Link
                    href={routes.cart}
                    prefetch={false}
                    onClick={() => close(false)}
                    className="flex min-h-11 items-baseline justify-between py-3 text-[1.05rem] leading-snug text-ink/80 transition-colors duration-300 hover:text-ink"
                  >
                    Sepet
                    <span className="label text-olive">
                      {showCount ? `${itemCount} ürün` : "Boşsa da buyurun"}
                    </span>
                  </Link>
                </li>
                <li className="border-b border-ink/10">
                  <Link
                    href={accountHref}
                    prefetch={false}
                    onClick={() => close(false)}
                    className="flex min-h-11 items-baseline justify-between py-3 text-[1.05rem] leading-snug text-ink/80 transition-colors duration-300 hover:text-ink"
                  >
                    {accountLabel}
                    <span aria-hidden="true" className="text-ink/30">
                      →
                    </span>
                  </Link>
                </li>
                <li className="border-b border-ink/10">
                  <Link
                    href={routes.contact}
                    prefetch={false}
                    onClick={() => close(false)}
                    className="flex min-h-11 items-baseline justify-between py-3 text-[1.05rem] leading-snug text-ink/80 transition-colors duration-300 hover:text-ink"
                  >
                    İletişim
                    <span aria-hidden="true" className="text-ink/30">
                      →
                    </span>
                  </Link>
                </li>
              </ul>

              {authHydrated && isLoggedIn && (
                <button
                  type="button"
                  onClick={() => {
                    close(false);
                    logout();
                  }}
                  className="mt-6 min-h-11 self-start text-sm text-ink/60 transition-colors duration-300 hover:text-ink"
                >
                  Çıkış yap
                </button>
              )}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
