/**
 * What "Tekrar sipariş ver" reports. Items whose product or variant has since
 * been removed cannot be added back, and the message says exactly how many.
 */
export function reorderMessage(lines: number, added: number): { ok: boolean; text: string } {
  if (added === 0) return { ok: false, text: "Bu siparişteki ürünler artık satışta değil." }
  if (added === lines) return { ok: true, text: `${added} ürün sepete eklendi.` }
  const missing = lines - added
  return { ok: true, text: `${lines} ürünün ${added} tanesi sepete eklendi; ${missing} ürün artık satışta değil.` }
}
