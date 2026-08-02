import Image from "next/image";
import Link from "next/link";
import type { ShopBannerSettings } from "@/lib/shop-banner";

export type ShopHeroBannerProps = Pick<
  ShopBannerSettings,
  "headline" | "subtext" | "imageUrl" | "ctaLabel" | "ctaHref"
>;

/**
 * Full-bleed promotional banner at the very top of the shop page.
 *
 * Assumes it is only rendered when headline and imageUrl are non-empty —
 * see shopBannerVisible() in lib/shop-banner.ts, which the caller checks
 * before mounting this component at all.
 */
export function ShopHeroBanner({
  headline,
  subtext,
  imageUrl,
  ctaLabel,
  ctaHref,
}: ShopHeroBannerProps) {
  const showCta = ctaLabel.trim() !== "" && ctaHref.trim() !== "";

  return (
    <section aria-labelledby="shop-banner-heading" className="on-dark">
      <div className="banner-top">
        <div className="relative h-[420px] w-full overflow-hidden md:h-[560px]">
          <Image
            src={imageUrl}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/25 to-transparent"
          />
          <div className="wrap relative flex h-full flex-col justify-end pb-12 md:pb-16">
            <h2
              id="shop-banner-heading"
              className="max-w-2xl text-3xl leading-[1.1] tracking-tight text-cream md:text-5xl"
            >
              {headline}
            </h2>
            {subtext.trim() !== "" && (
              <p className="mt-4 max-w-md text-base leading-relaxed text-cream/80">
                {subtext}
              </p>
            )}
            {showCta && (
              <Link
                href={ctaHref}
                className="mt-7 inline-block w-fit rounded-full bg-cream px-8 py-4 text-sm font-medium text-forest transition-colors duration-300 hover:bg-ivory"
              >
                {ctaLabel}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
