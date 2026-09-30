import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { site } from "@/lib/site";
import { getPublicSettings } from "@/lib/settings";
import { getPublishedTheme } from "@/lib/theme-settings";
import { ALL_FONT_VARIABLES } from "@/lib/fonts";
import { ThemeVars } from "@/components/theme/theme-vars";
import { Providers } from "@/components/providers";
import { WhatsAppFloat } from "@/components/layout/whatsapp-float";
import { themeInitScript } from "@/lib/theme-init";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

/**
 * Site metadata, with the default title, description and social image read from
 * the admin SEO settings. `getPublicSettings` is tag-cached and falls back to
 * the previously hard-coded copy, so this stays a static read — it introduces no
 * per-request work and no dynamic rendering.
 */
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicSettings();

  return {
    metadataBase: new URL(site.url),
    title: {
      default: settings.seoDefaultTitle,
      template: `%s | ${settings.storeName}`,
    },
    description: settings.seoDefaultDescription,
    keywords: [
      "Kabia Ekolojik",
      "organik badem",
      "kabuklu badem",
      "Marinada badem",
      "doğal fındık",
      "kabuklu fındık",
      "kabuklu ceviz",
      "ciğ badem",
      "doğal bal",
      "Kılıçkaya balı",
      "ıhlamur",
      "alıç sirkesi",
      "elma sirkesi",
      "domates salçası",
      "erişte",
      "tarhana",
      "ekolojik tarım",
      "organik tarım",
      "Geyve",
      "Sakarya",
      "Kılıçkaya",
    ],
    authors: [{ name: "Kabia Ekolojik", url: site.url }],
    creator: "Kabia Ekolojik",
    publisher: "Epilantis Kozmetik Estetik Medikal Sanayi Dış Tic. Ltd. Şti.",
    formatDetection: { email: false, address: false, telephone: false },
    category: "organic food, ecological agriculture",
    classification: "Ecological Agriculture, Organic Food",
    // No canonical or og:url here: nested metadata objects are replaced, not
    // merged, so anything set at the root is inherited verbatim by every route
    // that does not restate it — which pointed every such route's canonical and
    // share card at the homepage. Public routes state their own through
    // lib/seo.ts; the homepage's canonical lives on app/page.tsx. The en-US
    // alternate is gone too: there is no /en route, so it announced a 404.
    openGraph: {
      type: "website",
      locale: "tr_TR",
      siteName: settings.storeName,
      title: settings.seoDefaultTitle,
      description: settings.seoDefaultDescription,
      // The image is administered, so its dimensions are not known here, except
      // for the default: /og-default.jpg is a true 1200×630 share crop.
      images: [{ url: settings.seoSocialImage, alt: settings.storeName }],
    },
    twitter: {
      card: "summary_large_image",
      title: settings.seoDefaultTitle,
      description: settings.seoDefaultDescription,
      images: [settings.seoSocialImage],
      // No twitter:creator: x.com/kabiaekolojik could not be confirmed to
      // exist, so it is not claimed here either (see sameAs below).
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
    },
    verification: { google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION || undefined },
  };
}

export const viewport: Viewport = {
  // Cover lets the fixed header and the homepage film draw under the iPhone
  // status bar instead of leaving the theme-colour letterbox strip above the
  // navbar. The header (and the announcement band, and the mobile menu bar)
  // carry their own env(safe-area-inset-top) padding, so content still clears
  // the notch — see site-header.tsx and page-shell.tsx.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f1e8" },
    { media: "(prefers-color-scheme: dark)", color: "#12150f" },
  ],
};

/** Organization data limited to facts from the existing Kabia project. */
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: site.name,
  url: site.url,
  logo: `${site.url}/images/logo.svg`,
  email: site.email,
  telephone: site.phone,
  address: {
    "@type": "PostalAddress",
    addressLocality: "Geyve",
    addressRegion: "Sakarya",
    postalCode: "54700",
    streetAddress: "Sabırlar",
    addressCountry: "TR",
  },
  // What /iletisim shows: one line for phone and WhatsApp, the e-mail address,
  // and "Hafta içi 09:00–18:00 içinde dönüyoruz". Organization, not
  // LocalBusiness: Sabırlar is the orchard, not a shop with opening hours.
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer service",
    telephone: site.phone,
    email: site.email,
    availableLanguage: "Turkish",
    hoursAvailable: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "09:00",
      closes: "18:00",
    },
  },
  // Only the profiles confirmed to exist (2026-09-28): the Instagram account
  // and the Facebook page. x.com/kabiaekolojik could not be confirmed.
  sameAs: [site.social.instagram, site.social.facebook],
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: site.name,
  url: site.url,
  inLanguage: "tr-TR",
  publisher: { "@type": "Organization", name: site.name, logo: { "@type": "ImageObject", url: `${site.url}/images/logo.svg` } },
  // No SearchAction: /magaza has no text search (it filters by category and
  // source), so a search box pointing at ?q= would promise a result page that
  // does not exist.
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Paralel: theme = cache'li RPC, headers = sync; seri beklemeyi önle
  const [theme, h] = await Promise.all([getPublishedTheme(), headers()]);
  // SEC-09: Read the per-request nonce generated by the proxy for CSP.
  // This is used on inline scripts (theme init + JSON-LD) so they pass
  // the nonce-based CSP without 'unsafe-inline'.
  // Turbopack dev may briefly serve stale HTML where x-nonce is "" – treat
  // empty string as missing to avoid `nonce=""` hydration mismatch.
  const rawNonce = h.get("x-nonce");
  const nonce = rawNonce && rawNonce.length > 0 ? rawNonce : undefined;

  return (
    <html
      lang="tr"
      className={`${ALL_FONT_VARIABLES} h-full`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies the stored light/dark choice before first paint. */}
        <script
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
          nonce={nonce}
          suppressHydrationWarning
        />
        {/* Applies the published theme variables before first paint. */}
        <ThemeVars theme={theme} />
      </head>
      <body className="min-h-full flex flex-col">
        {/* §5.3: skip link — visually hidden until keyboard focus. Every page
            exposes a main#icerik landmark (PageShell, homepage, admin). */}
        <a
          href="#icerik"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-theme-button focus:bg-ink focus:px-5 focus:py-3 focus:text-sm focus:text-ivory"
        >
          İçeriğe atla
        </a>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
          nonce={nonce}
          suppressHydrationWarning
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
          nonce={nonce}
          suppressHydrationWarning
        />
        <Providers>
          {children}
          <WhatsAppFloat />
        </Providers>
        {/* Real-user Core Web Vitals (Vercel Speed Insights): no cookies, no
            personal data; the loader script is same-origin
            (/_vercel/speed-insights), injected by the trusted bundle so the
            nonce CSP's 'strict-dynamic' admits it. The RUM beacon itself
            POSTs to https://vitals.vercel-insights.com, which connect-src
            in proxy.ts explicitly allowlists — without that entry the
            browser blocks every beacon. Rendered only on Vercel,
            where that path exists. */}
        {process.env.VERCEL ? <SpeedInsights /> : null}
      </body>
    </html>
  );
}
