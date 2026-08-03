import type { Metadata } from "next"
import ShopPage, { metadata as shopMetadata } from "@/app/shop/page"

/**
 * Native Turkish storefront entry. It renders the same server component as
 * `/shop` without a redirect, so direct entry and hard refresh each have one
 * document request and keep the requested URL.
 */
export const metadata: Metadata = {
  ...shopMetadata,
  alternates: { canonical: "/magaza" },
}

export default ShopPage
