/**
 * Shop page hero banner — pure visibility rule.
 *
 * Kept free of any database or Next.js import so it can be unit tested
 * directly (this repo's test runner does not transform .tsx, so any logic
 * worth testing has to live in a plain .ts module like this one).
 */

export interface ShopBannerSettings {
  enabled: boolean
  headline: string
  subtext: string
  imageUrl: string
  ctaLabel: string
  ctaHref: string
}

/**
 * Mirrors next.config.ts's remotePatterns allowlist (picsum's two hosts plus
 * this project's own Supabase storage host) so a value next/image would
 * reject never reaches it — next/image throws at render time for an
 * unlisted host or a malformed path, which would otherwise take down the
 * entire /shop route for every visitor.
 */
const ALLOWED_IMAGE_HOSTS = ["picsum.photos", "fastly.picsum.photos"]

function supabaseImageHost(): string | undefined {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return undefined
  try {
    return new URL(url).hostname
  } catch {
    return undefined
  }
}

/** True for a same-origin root-relative path, or an https URL on an allowlisted host. */
export function isPlausibleBannerImageUrl(url: string): boolean {
  const trimmed = url.trim()
  if (trimmed === "") return false
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return true
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== "https:") return false
    return ALLOWED_IMAGE_HOSTS.includes(parsed.hostname) || parsed.hostname === supabaseImageHost()
  } catch {
    return false
  }
}

/** The banner needs to be turned on and have at least a headline and an image. */
export function shopBannerVisible(settings: ShopBannerSettings): boolean {
  return (
    settings.enabled &&
    settings.headline.trim() !== "" &&
    isPlausibleBannerImageUrl(settings.imageUrl)
  )
}
