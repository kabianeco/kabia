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
  const [scrollReady, setScrollReady] = useState(false);
  // The menu remembers the route it was opened on, so any navigation closes it
  // by derivation — no effect needed to reset it.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;
  const headerRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  // The icon and the attached menu use CSS motion, with the same destinations
  // available without animation for reduced-motion visitors.
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    let frame = 0;
    let readyFrame = 0;
    let readyFrame2 = 0;
    const mobile = window.matchMedia("(max-width: 1023px)");
    const updateScroll = () => {
      frame = 0;
      // On the homepage the entire intro, including its green closing line,
      // belongs to the full-bleed story. The floating surface starts only
      // once that section has left the viewport. Other pages keep the small
      // top-of-page hysteresis they already use.
      const homeMobile = isHome && mobile.matches;
      const heroBottom = homeMobile
        ? document.querySelector("[data-site-hero]")?.getBoundingClientRect().bottom
        : undefined;
      setScrolled((wasScrolled) => homeMobile
        ? heroBottom === undefined
          ? false
          : heroBottom < -4 ? true : heroBottom > 4 ? false : wasScrolled
        : window.scrollY > 16 ? true : window.scrollY < 4 ? false : wasScrolled);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(updateScroll);
    };
    // A restored position is measured after hydration while transitions are
    // disabled, so the first client change cannot animate from the SSR shape.
    updateScroll();
    readyFrame = window.requestAnimationFrame(() => {
      readyFrame2 = window.requestAnimationFrame(() => setScrollReady(true));
    });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(readyFrame);
      window.cancelAnimationFrame(readyFrame2);
    };
  }, [isHome]);

  const close = useCallback((restoreFocus = true) => {
    setOpenedOn(null);
    if (restoreFocus) window.requestAnimationFrame(() => toggleRef.current?.focus());
  }, []);

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

  // The attached menu behaves as a disclosure: Escape returns to the toggle,
  // while a tap outside closes it without taking focus from the tapped item.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
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
      ref={headerRef}
      className={cn(
        // The bar starts at top: 0 and draws under the status bar
        // (viewport-fit=cover in app/layout.tsx). The inset is applied
        // exactly once in the stack: with the announcement band the band
        // already carries it, so the header only offsets below the band;
        // without the band the header pads itself clear of the notch.
        "site-header fixed inset-x-0 z-40",
        isHome && scrolled && "site-header--past-hero",
        bannerOffset && "site-header--with-banner",
        !scrollReady && "site-header--initial",
        bannerOffset
          ? "top-[calc(2.5rem+var(--safe-top))]"
          : "top-0 pt-[var(--safe-top)]",
        // The menu grows from the bar itself. The outer header keeps its
        // desktop surface, while mobile draws the surface on the card.
        open && "site-header--menu-open",
        open
          ? "lg:border-b lg:border-ink/10 lg:bg-ivory"
          : surfaced
            ? "lg:border-b lg:border-ink/10 lg:bg-ivory/95 lg:backdrop-blur-sm"
            // Floating with no ground of its own means floating over the
            // intro's footage, which is dark. The ink palette used everywhere
            // else is invisible there, so the header borrows the light one
            // (see .site-header--over-film in globals.css).
            : "site-header--over-film lg:border-b lg:border-transparent lg:bg-transparent",
      )}
    >
      {!bannerOffset && (
        <div
          aria-hidden="true"
          className={cn(
            "site-header__safe-area absolute inset-x-0 top-0 h-[var(--safe-top)] lg:hidden",
            surfaced ? "bg-ivory" : "bg-transparent",
          )}
        />
      )}
      <div
        className={cn(
          "site-header__bar relative lg:h-20 lg:bg-transparent",
          scrolled && "site-header__bar--floating",
          open && "site-header__bar--open",
          open || scrolled ? "bg-ivory" : surfaced ? "bg-ivory/95" : "bg-transparent",
          surfaced && !open && !scrolled && "backdrop-blur-sm lg:backdrop-blur-none",
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
            className="site-header__logo h-7 w-auto md:h-8"
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
            onClick={() => (open ? close(false) : setOpenedOn(pathname))}
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

        <div
          id="mobile-menu"
          className={cn(
            "site-header__menu-panel lg:hidden",
            open && "site-header__menu-panel--open",
          )}
          aria-hidden={!open}
        >
          <div className="site-header__menu-content">
            <nav
              aria-label="Mobil menü"
              className="wrap flex w-full flex-col pb-6 pt-5"
            >
              <p className="label text-olive">Kabia</p>
              <ul>
                {mobilePrimary.map((item) => (
                  <li key={item.href} className="border-b border-ink/10">
                    <Link
                      href={item.href}
                      prefetch={false}
                      onClick={() => close(false)}
                      tabIndex={open ? undefined : -1}
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
                    tabIndex={open ? undefined : -1}
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
                    tabIndex={open ? undefined : -1}
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
                    tabIndex={open ? undefined : -1}
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
                  tabIndex={open ? undefined : -1}
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
      </div>
    </header>
  );
}
