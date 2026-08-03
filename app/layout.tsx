import type { Metadata, Viewport } from "next";
import { site } from "@/lib/site";
import { getPublicSettings } from "@/lib/settings";
import { getPublishedTheme } from "@/lib/theme-settings";
import { ALL_FONT_VARIABLES } from "@/lib/fonts";
import { ThemeVars } from "@/components/theme/theme-vars";
import { Providers } from "@/components/providers";
import { themeInitScript } from "@/lib/theme";
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
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      locale: "tr_TR",
      url: site.url,
      siteName: settings.storeName,
      title: settings.seoDefaultTitle,
      description: settings.seoDefaultDescription,
      images: [
        {
          url: settings.seoSocialImage,
          width: 1536,
          height: 2040,
          alt: "Kurumaya serilmiş kabuklu Kabia bademleri",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: settings.seoDefaultTitle,
      description: settings.seoDefaultDescription,
      images: [settings.seoSocialImage],
    },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: "#f4f1e8",
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
  sameAs: [site.social.instagram, site.social.facebook, site.social.x],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Load the published theme once at the shell boundary. The result is
  // tag-cached and validated; on any failure it degrades to the default
  // balanced + Kabia Original theme. Rendered into <head> below so the first
  // paint already matches — no theme flash.
  const theme = await getPublishedTheme();

  return (
    <html
      lang="tr"
      className={`${ALL_FONT_VARIABLES} h-full`}
      /*
       * The theme script below stamps `data-theme` on this element before
       * React hydrates, so the visitor's stored choice is painted with the
       * very first frame. That attribute is intentionally absent from the
       * server HTML — the server cannot know a value that lives in
       * localStorage — which React would otherwise report as a hydration
       * mismatch. The flag is scoped to this one element's attributes and
       * does not affect anything rendered inside it.
       */
      suppressHydrationWarning
    >
      <head>
        {/* Applies the stored light/dark choice before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {/* Applies the published theme variables before first paint. */}
        <ThemeVars theme={theme} />
      </head>
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
