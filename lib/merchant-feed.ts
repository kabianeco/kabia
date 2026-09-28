import type { Product } from "@/lib/products"
import { routes, site } from "@/lib/site"
import { absoluteUrl } from "@/lib/seo"

/**
 * Google Merchant Center product feed (RSS 2.0 + the g: namespace), built only
 * from what the catalogue stores.
 *
 * One item per size: `g:id` is the variant id, `g:item_group_id` the product
 * id (the same ids the product page's structured data uses as sku and
 * productGroupID), and `link` opens the product page on that size (?boyut=),
 * so the landing page shows the price the item states.
 *
 * Left out on purpose, not forgotten:
 * - shipping and returns: the site states three shipping fees and two return
 *   windows; they belong in the Merchant Center account once confirmed.
 * - brand for producers' goods: only the farm's own produce is a Kabia
 *   Ekolojik product; the rest wait for the owner to name their brand.
 * - GTIN / MPN: the catalogue has none, so identifier_exists is "no".
 */

export const MERCHANT_FEED_PATH = "/feeds/google-merchant.xml"

export interface FeedSkip {
  product: string
  reason: string
}

export interface MerchantFeed {
  xml: string
  items: number
  skipped: FeedSkip[]
}

const MAX_ADDITIONAL_IMAGES = 10

/** XML text: escaped, control characters dropped, whitespace kept readable. */
function text(value: string): string {
  return value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function tag(name: string, value: string): string {
  return `<${name}>${text(value)}</${name}>`
}

/** Google's price format: "550.00 TRY". */
export function feedPrice(amount: number): string {
  return `${amount.toFixed(2)} TRY`
}

export function buildMerchantFeed(products: readonly Product[]): MerchantFeed {
  const items: string[] = []
  const skipped: FeedSkip[] = []

  for (const product of products) {
    const description = (product.description || product.shortDescription).trim()
    const images = [...new Set([product.mainImageUrl, ...product.images].filter(Boolean).map(absoluteUrl))]
    if (product.variants.length === 0) {
      skipped.push({ product: product.slug, reason: "no sizes, so no price" })
      continue
    }
    if (images.length === 0) {
      skipped.push({ product: product.slug, reason: "no image (image_link is required)" })
      continue
    }
    if (!description) {
      skipped.push({ product: product.slug, reason: "no description (required)" })
      continue
    }

    for (const variant of product.variants) {
      if (!(variant.price > 0)) {
        skipped.push({ product: `${product.slug} ${variant.weight}`, reason: "no price" })
        continue
      }
      const fields = [
        tag("g:id", variant.id),
        ...(product.variants.length > 1 ? [tag("g:item_group_id", product.id)] : []),
        tag("title", `${product.name} ${variant.weight}`.slice(0, 150)),
        tag("description", description.slice(0, 5000)),
        tag("link", `${site.url}${routes.product(product.slug)}?boyut=${encodeURIComponent(variant.weight)}`),
        tag("g:image_link", images[0]),
        ...images.slice(1, 1 + MAX_ADDITIONAL_IMAGES).map((url) => tag("g:additional_image_link", url)),
        tag("g:availability", variant.stock > 0 ? "in_stock" : "out_of_stock"),
        tag("g:price", feedPrice(variant.price)),
        tag("g:condition", "new"),
        ...(product.source === "ciftlik" ? [tag("g:brand", site.name)] : []),
        tag("g:identifier_exists", "no"),
        ...(product.variants.length > 1 ? [tag("g:size", variant.weight)] : []),
        ...(product.categoryName ? [tag("g:product_type", product.categoryName)] : []),
      ]
      items.push(`<item>\n${fields.map((field) => `  ${field}`).join("\n")}\n</item>`)
    }
  }

  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">`,
    `<channel>`,
    tag("title", site.name),
    tag("link", site.url),
    tag("description", `${site.name} ürün kataloğu`),
    ...items,
    `</channel>`,
    `</rss>`,
    ``,
  ].join("\n")

  return { xml, items: items.length, skipped }
}
