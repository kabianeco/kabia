import type { Metadata } from "next"
import { getPublicSettings } from "@/lib/settings"
import { site } from "@/lib/site"

/**
 * Per-route metadata, built one way everywhere.
 *
 * Next merges metadata segment by segment and replaces nested objects whole:
 * a page that sets only `title` and `description` inherits the root layout's
 * `openGraph`, `twitter` and `alternates` untouched. That is how every share
 * card on the site came to carry the homepage's title and URL, and how routes
 * without their own canonical pointed search engines at the homepage. Every
 * public route now states all of them through this helper.
 *
 * The social image defaults to the administered one from the SEO settings
 * (tag-cached, the same read the root layout makes), so changing it in the
 * dashboard still changes every card that has no image of its own.
 */
export interface PageSeo {
  /** The page's own title; the layout template appends the store name. */
  title: string
  /** Use the title as given, without the template (the homepage). */
  absoluteTitle?: boolean
  description: string
  /** Root-relative canonical path, e.g. "/magaza". */
  path: string
  image?: { url: string; alt?: string }
  /** Skip the default share image: a colocated opengraph-image file serves it. */
  skipImage?: boolean
  type?: "website" | "article"
  keywords?: string[]
  /** Private or transactional pages: kept out of the index, links still followed. */
  noindex?: boolean
}

export async function pageMetadata(seo: PageSeo): Promise<Metadata> {
  const settings = await getPublicSettings()
  const socialTitle = seo.absoluteTitle ? seo.title : `${seo.title} | ${settings.storeName}`
  const description = metaDescription(seo.description)
  // A colocated opengraph-image file serves the card: setting images here as
  // well suppresses the file-convention tags, so skip the default entirely.
  const image = seo.skipImage ? undefined : (seo.image ?? { url: settings.seoSocialImage, alt: settings.storeName })

  return {
    title: seo.absoluteTitle ? { absolute: seo.title } : seo.title,
    description,
    ...(seo.keywords ? { keywords: seo.keywords } : {}),
    alternates: { canonical: seo.path },
    openGraph: {
      type: seo.type ?? "website",
      locale: "tr_TR",
      siteName: settings.storeName,
      url: seo.path,
      title: socialTitle,
      description,
      ...(image ? { images: [image] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      ...(image ? { images: [image.url] } : {}),
    },
    ...(seo.noindex ? { robots: { index: false, follow: true } } : {}),
  }
}

/**
 * A description is a snippet, not the page: long story text is cut at a word
 * boundary near 160 characters so search results show a sentence, not a
 * mid-word truncation. Blank-line paragraph breaks collapse to spaces.
 */
export function metaDescription(text: string, max = 160): string {
  const flat = text.replace(/\s+/g, " ").trim()
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(" ")
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:—–-]+$/, "")}…`
}

/** An absolute URL for structured data, which does not resolve relative paths. */
export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl
  return `${site.url}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`
}

/**
 * BlogPosting for a dated page (journal entries; guide pages later). The
 * author and publisher are the organisation: the journal is the farm's own
 * log and names no person. `dateModified` is stated only when the page has one.
 */
export function articleJsonLd(article: {
  headline: string
  description: string
  path: string
  datePublished: string
  dateModified?: string
  image?: string
}) {
  const organization = {
    "@type": "Organization",
    name: site.name,
    url: site.url,
    logo: { "@type": "ImageObject", url: `${site.url}/images/logo.svg` },
  }
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.headline,
    description: article.description,
    inLanguage: "tr-TR",
    mainEntityOfPage: absoluteUrl(article.path),
    datePublished: article.datePublished,
    ...(article.dateModified ? { dateModified: article.dateModified } : {}),
    ...(article.image ? { image: [absoluteUrl(article.image)] } : {}),
    author: organization,
    publisher: organization,
  }
}

/** BreadcrumbList from ordered [name, path] pairs, home first. */
export function breadcrumbJsonLd(trail: readonly (readonly [name: string, path: string])[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map(([name, path], index) => ({
      "@type": "ListItem",
      position: index + 1,
      name,
      item: path === "/" ? site.url : absoluteUrl(path),
    })),
  }
}
