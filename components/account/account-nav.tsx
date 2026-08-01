"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { routes } from "@/lib/site";

const SECTIONS = [
  { href: routes.account, label: "Özet", exact: true },
  { href: `${routes.account}/siparislerim`, label: "Siparişlerim" },
  { href: `${routes.account}/adreslerim`, label: "Adreslerim" },
  { href: `${routes.account}/favorilerim`, label: "Favorilerim" },
  { href: `${routes.account}/kart-bilgilerim`, label: "Kartlarım" },
  { href: `${routes.account}/bilgilerim`, label: "Bilgilerim" },
  { href: `${routes.account}/bildirimler`, label: "Bildirimler" },
];

export function AccountNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  const handleLogout = async () => {
    await logout();
    router.push(routes.home);
  };

  return (
    <nav aria-label="Hesap menüsü" className="lg:sticky lg:top-28">
      {user && (
        <div className="hidden lg:block">
          <p className="label text-olive">Hesap</p>
          <p className="mt-2 truncate font-serif text-xl">{user.name}</p>
        </div>
      )}

      {/* Scrolls horizontally on small screens, stacks as a ledger on desktop. */}
      <ul className="-mx-6 flex gap-6 overflow-x-auto px-6 pb-2 lg:mx-0 lg:mt-8 lg:flex-col lg:gap-0 lg:overflow-visible lg:border-t lg:border-ink/10 lg:px-0 lg:pb-0">
        {SECTIONS.map((section) => {
          const active = isActive(section.href, section.exact);
          return (
            <li key={section.href} className="shrink-0 lg:border-b lg:border-ink/10">
              <Link
                href={section.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center whitespace-nowrap text-sm transition-colors duration-300 lg:min-h-0 lg:py-3.5 ${
                  active ? "text-brand" : "text-ink/55 hover:text-ink"
                }`}
              >
                {section.label}
              </Link>
            </li>
          );
        })}
        <li className="shrink-0 lg:mt-6">
          <button
            type="button"
            onClick={handleLogout}
            className="flex min-h-11 items-center whitespace-nowrap text-sm text-ink/45 transition-colors duration-300 hover:text-clay lg:min-h-0"
          >
            Çıkış yap
          </button>
        </li>
      </ul>
    </nav>
  );
}
