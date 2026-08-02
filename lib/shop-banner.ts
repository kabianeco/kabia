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

/** The banner needs to be turned on and have at least a headline and an image. */
export function shopBannerVisible(settings: ShopBannerSettings): boolean {
  return (
    settings.enabled &&
    settings.headline.trim() !== "" &&
    settings.imageUrl.trim() !== ""
  )
}
