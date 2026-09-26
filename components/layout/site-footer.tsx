import Image from "next/image";
import Link from "next/link";
import { anchors, homeAnchor, legalLinks, routes, whatsappHref } from "@/lib/site";
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
   homepage sections do not exist.
   Grouped by brand pillar (Appendix A.10 of the KABIA 2.0 brief) rather than
   by page type. Phase 3 added /ureticiler, /kabia-standardi, /gunluk
   and /ciftlik, so those now appear below. Hikâyemiz and Akademi are
   still P2/deferred — not linked here yet, since those routes don't exist. */
/* Three quiet columns: what Kabia sells, where it grows, and how to reach
   it. Legal destinations live once in the tertiary row below — never
   repeated up here. */
const shopItems = [
  { label: "Mağaza", href: routes.store },
  { label: "Seçki", href: routes.secki },
  { label: "Mutfak", href: routes.mutfak },
  { label: "Üreticiler", href: routes.producers },
];

const farmItems = [
  { label: "Çiftliğimiz", href: routes.farm },
  { label: "Yaklaşım", href: routes.farmApproach },
  { label: "Emanet", href: `${routes.farm}#emanet` },
  { label: "Sertifika", href: `${routes.farm}#sertifika` },
  { label: "Saha Notları", href: routes.journal },
];

const supportItems = [
  { label: "Sepet", href: routes.cart },
  { label: "Hesabım", href: routes.account },
  { label: "İletişim", href: routes.contact },
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
      <div className="mx-auto max-w-[1200px] px-6 md:px-10 py-12 md:py-16">
        {/* Primary: brand and contact, then the three ways in. */}
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-12">
          <div className="sm:col-span-2 lg:col-span-5">
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
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-ink/70">
              Toprağa saygıyla üretilenleri bir araya getiriyoruz.
            </p>
            <address className="mt-5 space-y-2 text-sm not-italic text-ink/70">
              <p>{settings.contactAddress}</p>
              <p>
                <a
                  href={`mailto:${settings.supportEmail}`}
                  className="hover:text-ink transition-colors duration-300"
                >
                  {settings.supportEmail}
                </a>
              </p>
              <p>
                <a
                  href={phoneHref}
                  className="hover:text-ink transition-colors duration-300"
                >
                  {settings.supportPhone}
                </a>
              </p>
              <p>
                <a
                  href={whatsappHref()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-ink transition-colors duration-300"
                >
                  WhatsApp’tan yazın
                </a>
              </p>
              {settings.supportHours && (
                <p className="text-ink/70">{settings.supportHours}</p>
              )}
            </address>
            {socialItems.length > 0 && (
              <ul className="mt-5 flex gap-1">
                {socialItems.map(({ label, href, Icon }) => (
                  <li key={label}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={label}
                      className="flex h-11 w-11 items-center justify-center text-ink/70 hover:text-ink transition-colors duration-300"
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <nav aria-label="Mağaza menüsü" className="lg:col-span-2">
            <h2 className="label text-olive">Mağaza</h2>
            <ul className="mt-5 space-y-3">
              {shopItems.map((item) => (
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

          <nav aria-label="Çiftlik menüsü" className="lg:col-span-2">
            <h2 className="label text-olive">Çiftlik</h2>
            <ul className="mt-5 space-y-3">
              {farmItems.map((item) => (
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

          <nav aria-label="Destek menüsü" className="lg:col-span-2">
            <h2 className="label text-olive">Destek</h2>
            <ul className="mt-5 space-y-3">
              {supportItems.map((item) => (
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
        </div>

        {/* Secondary: trust stated as plain type, not badges. */}
        <div className="mt-10 border-t border-ink/10 pt-6">
          <p className="text-xs leading-relaxed text-ink/70">
            256-bit SSL · 3D Secure · ETBİS kayıtlı satıcı · 14 gün cayma hakkı
          </p>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-ink/70">
            Ödeme altyapısı PCI-DSS uyumlu kuruluşlar üzerinden yürütülür; kart bilgileriniz bizde saklanmaz.
          </p>
        </div>

        {/* Tertiary: the legal row, stated once. */}
        <div className="mt-6 flex flex-col gap-3 border-t border-ink/10 pt-6 text-xs text-ink/70 lg:flex-row lg:items-center lg:justify-between">
          <p>© {new Date().getFullYear()} Kabia Ekolojik. Tüm hakları saklıdır.</p>
          <nav aria-label="Yasal menü">
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              {legalLinks.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} prefetch={false} className="hover:text-ink transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <p className="text-ink/70">Sabırlar Köyü, Geyve</p>
        </div>
      </div>
    </footer>
  );
}
