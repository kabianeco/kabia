/** Kept after preview teardown: old guest storage must never become an order. */
export interface PreviewIdentity { id?: string; slug?: string; productId?: string; variantId?: string }
export const PREVIEW_MESSAGE = "Sepetinizde önizleme ürünü var. Ödemeye geçmek için örnek ürünleri kaldırın.";
export const PREVIEW_GUEST_MESSAGE = "Önizleme ürünleri yalnızca misafir sepetinde denenebilir.";

// S23: normalize before comparing — a bare startsWith is fooled by padding,
// case games and invisible characters. The reserved shapes stay anchored and
// non-empty so "onizleme-" alone (or "kabia-preview:" with no id) never
// matches, while every real preview identity still does.
const ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g;
function normalizePreviewValue(value: string): string {
  return value.trim().toLowerCase().normalize("NFKC").replace(ZERO_WIDTH, "");
}
const PREVIEW_SLUG = /^onizleme-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PREVIEW_ID = /^kabia-preview:[a-z0-9._-]+(?::[a-z0-9._-]+)?$/;
export function isPreviewItem(item: PreviewIdentity): boolean {
  return [item.id, item.slug, item.productId, item.variantId].some(
    (value) =>
      typeof value === "string" &&
      (PREVIEW_SLUG.test(normalizePreviewValue(value)) ||
        PREVIEW_ID.test(normalizePreviewValue(value))),
  );
}
export function hasPreviewItems(items: readonly PreviewIdentity[]): boolean {
  return items.some(isPreviewItem);
}
