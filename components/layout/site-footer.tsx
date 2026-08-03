import Image from "next/image";
import Link from "next/link";
import { anchors, homeAnchor, routes } from "@/lib/site";
import { getPublicSettings } from "@/lib/settings";

/* Lucide dropped brand icons; these are minimal inline equivalents. */
function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FacebookIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M13.5 21v-7h2.4l.4-3h-2.8V9.1c0-.9.3-1.5 1.6-1.5h1.3V4.9c-.3 0-1.1-.1-2-.1-2 0-3.4 1.2-3.4 3.5V11H8.5v3H11v7h2.5Z" />
    </svg>
  );
}

function XIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M17.7 3h2.9l-6.4 7.3L21.7 21h-5.9l-4.6-6-5.3 6H3l6.9-7.8L3 3h6l4.2 5.5L17.7 3Zm-1 16.2h1.6L7.1 4.7H5.4l11.3 14.5Z" />
    </svg>
  );
}

/* Absolute so these keep working from the store and account routes, where the
   homepage sections do not exist. */
const navItems = [
  { label: "Ürünler", href: homeAnchor(anchors.products) },
  { label: "Çiftlik", href: homeAnchor(anchors.farm) },
  { label: "Yaklaşım", href: homeAnchor(anchors.approach) },
  { label: "İletişim", href: homeAnchor(anchors.contact) },
];

const storeItems = [
  { label: "Mağaza", href: routes.store },
  { label: "Sepet", href: routes.cart },
  { label: "Hesabım", href: routes.account },
];

export async function SiteFooter() {
  // Contact details and social links are editable from the admin content screen.
  // getPublicSettings is tag-cached and falls back to lib/site.ts, so the footer
  // renders correctly even if the database is unreachable.
  const settings = await getPublicSettings();

  const socialItems = [
    { label: "Instagram", href: settings.socialInstagram, Icon: InstagramIcon },
    { label: "Facebook", href: settings.socialFacebook, Icon: FacebookIcon },
    { label: "X (Twitter)", href: settings.socialX, Icon: XIcon },
  ].filter((item) => Boolean(item.href));

  const phoneHref = `tel:${settings.supportPhone.replace(/[^\d+]/g, "")}`;

  return (
    <footer className="bg-paper border-t border-ink/10">
      <div className="mx-auto max-w-[1200px] px-6 md:px-10 py-14 md:py-20">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-4">
            <Link
              href="/"
              prefetch={false}
              aria-label="Kabia Ekolojik — anasayfa"
              className="inline-block"
            >
              <Image
                src="/images/logo.svg"
                alt="Kabia Ekolojik"
                width={236}
                height={80}
                className="h-9 w-auto"
              />
            </Link>
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-ink/60">
              Sakarya Geyve&apos;de, kimyasal gübre ve ilaç kullanmadan
              yetiştirilen badem.
            </p>
          </div>

          <nav aria-label="Alt menü" className="md:col-span-2">
            <h2 className="label text-olive">Sayfa</h2>
            <ul className="mt-5 space-y-3">
              {navItems.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="text-sm text-ink/70 hover:text-ink transition-colors duration-300"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Mağaza menüsü" className="md:col-span-3">
            <h2 className="label text-olive">Alışveriş</h2>
            <ul className="mt-5 space-y-3">
              {storeItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    prefetch={false}
                    className="text-sm text-ink/70 hover:text-ink transition-colors duration-300"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="md:col-span-3">
            <h2 className="label text-olive">İletişim</h2>
            <ul className="mt-5 space-y-3 text-sm text-ink/70">
              <li>{settings.contactAddress}</li>
              <li>
                <a
                  href={`mailto:${settings.supportEmail}`}
                  className="hover:text-ink transition-colors duration-300"
                >
                  {settings.supportEmail}
                </a>
              </li>
              <li>
                <a
                  href={phoneHref}
                  className="hover:text-ink transition-colors duration-300"
                >
                  {settings.supportPhone}
                </a>
              </li>
              {settings.supportHours && (
                <li className="text-ink/50">{settings.supportHours}</li>
              )}
            </ul>
            <ul className="mt-6 flex gap-3">
              {socialItems.map(({ label, href, Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="flex h-11 w-11 items-center justify-center rounded-theme-icon-container border border-ink/15 text-ink/70 hover:border-brand hover:text-brand transition-colors duration-300"
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-2 border-t border-ink/10 pt-6 text-xs text-ink/50 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} Kabia Ekolojik. Tüm hakları saklıdır.</p>
          <p>Sabırlar Köyü, Geyve — badem üreticisi</p>
        </div>
      </div>
    </footer>
  );
}
