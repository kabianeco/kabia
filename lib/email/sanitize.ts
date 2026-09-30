/**
 * Gelen HTML temizliği — yöneticiye gösterilmeden önce sunucuda.
 *
 * NEDEN YENİ BAĞIMLILIK (`sanitize-html`):
 * El yazısı bir temizleyici, HTML ayrıştırmanın uç durumlarını (iç içe
 * bozuk etiketler, SVG yükleri, CSS ifadeleri, kodlanmış `javascript:`
 * şemaları, meta refresh) kapatamaz; her biri oturum çalma demektir.
 * `sanitize-html` (htmlparser2 tabanlı, bakımlı, sunucuda DOM gerektirmez,
 * ~milyon indirme/hafta) katı izin-listesiyle bu sınıfı kapatır. Kendi
 * ayrıştırıcımızı yazmak, denetlenmemiş bir güvenlik sınırı yazmak olurdu.
 *
 * Politika:
 *   - İzinli metin/biçim etiketleri + tablo + alıntı; `style` özniteliği yok,
 *     olay işleyiciler yok, form/iframe/object/embed/video/audio yok, SVG yok.
 *   - Bağlantı şemaları: http/https/mailto/tel. Hedef her zaman yeni sekme +
 *     `rel="noopener noreferrer"`.
 *   - Uzak görseller (`http/https` img) varsayılan KAPALI: açılır-takip
 *     (open tracking) okundu bilgisini sızdırır. İleti başına "görselleri
 *     göster" ile açılır.
 *   - `data:` gömülü görseller ile `cid:` eşleşen ekler (imzalı URL'ye
 *     çevrilir) uzak sayılmaz — üçüncü tarafa istek çıkmaz — her zaman görünür.
 */

import sanitizeHtml from "sanitize-html"

export interface SanitizeInput {
  html: string
  /** true ise uzak (http/https) görseller de korunur. */
  allowRemoteImages: boolean
  /** `cid:içerikKimliği` → imzalı ek URL'si. */
  cidMap?: Record<string, string>
}

export interface SanitizeResult {
  html: string
  /** Engellenen uzak görsel sayısı (bilgi rozeti için). */
  blockedImages: number
}

const REMOTE_IMG_RE = /<img\b[^>]*\bsrc\s*=\s*(["']?)\s*https?:[^>]*>/gi

export function countRemoteImages(html: string): number {
  const matches = html.match(REMOTE_IMG_RE)
  return matches ? matches.length : 0
}

export function sanitizeInboundHtml(input: SanitizeInput): SanitizeResult {
  const blockedImages = input.allowRemoteImages ? 0 : countRemoteImages(input.html)
  const cidMap = input.cidMap ?? {}

  const html = sanitizeHtml(input.html, {
    allowedTags: [
      "p", "br", "div", "span", "blockquote", "pre", "code",
      "h1", "h2", "h3", "h4", "h5", "h6", "hr",
      "ul", "ol", "li", "strong", "b", "em", "i", "u", "s",
      "a", "img",
      "table", "thead", "tbody", "tfoot", "tr", "td", "th",
    ],
    allowedAttributes: {
      // target/rel listede çünkü transformTags her bağlantıya güvenli
      // değerleri yazar; saldırganın kendi rel'i ezilir.
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "width", "height", "data-inline"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
      blockquote: ["cite"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: {
      img: ["http", "https", "data", "cid"],
    },
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer" },
      }),
      img: (_tagName, attribs) => {
        const src = (attribs.src ?? "").trim()
        // Ekli görsel: imzalı URL'ye çevrilir ve işaretlenir; uzak-filtreye takılmaz.
        if (src.toLowerCase().startsWith("cid:")) {
          const key = src.slice(4).split("?")[0].split("#")[0]
          const mapped = cidMap[key] ?? cidMap[key.replace(/^<|>$/g, "")]
          if (mapped) {
            return { tagName: "img", attribs: { ...attribs, src: mapped, "data-inline": "1" } }
          }
          // Karşılığı yoksa düşür (iz sürülemez, kırık görsel de gösterilmez).
          return { tagName: "span", attribs: {} }
        }
        return { tagName: "img", attribs }
      },
    },
    exclusiveFilter: (frame) => {
      // Uzak görsel engeli: http/https kaynaklı img, izin yoksa düşer.
      // data-inline işaretliler (cid eşleşen ekler) korunur.
      if (frame.tag === "img" && !input.allowRemoteImages) {
        if (frame.attribs["data-inline"] === "1") return false
        const src = (frame.attribs.src ?? "").trim().toLowerCase()
        if (src.startsWith("http://") || src.startsWith("https://")) return true
      }
      return false
    },
  })

  return { html, blockedImages }
}
