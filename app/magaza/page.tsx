import ShopPage from "@/app/shop/page"

/**
 * Native Turkish storefront entry. It renders the same server component as
 * `/shop` without a redirect, so direct entry and hard refresh each have one
 * document request and keep the requested URL.
 */
export { generateMetadata } from "@/app/shop/page"

export default ShopPage
