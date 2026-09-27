import { ImageResponse } from "next/og"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

/**
 * Shared share-card renderer (1200×630, brand paper + ink + green).
 * Server-only: used by opengraph-image routes on the nodejs runtime.
 *
 * Photos: local /images/* are embedded from public/ (works in local builds
 * and production); remote URLs are fetched. Anything unreadable falls back
 * to the text-only card — the route never throws, so a page never loses its
 * share image at runtime.
 */

const W = 1200
const H = 630
const PAPER = "#f4f1e8"
const INK = "#1c201b"
const MUTED = "#77806f"
const BRAND = "#147b4b"

interface OgFonts {
  serif: Buffer
  sans: Buffer
  sansBold: Buffer
}

let fontsPromise: Promise<OgFonts> | null = null

/** Full-charset TTFs (legacy UA → no unicode-range split → Turkish glyphs intact). */
function loadFonts(): Promise<OgFonts> {
  if (!fontsPromise) {
    fontsPromise = (async () => {
      const css = await (
        await fetch(
          "https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Instrument+Sans:wght@400;600&display=swap",
          { headers: { "User-Agent": "Mozilla/4.0" } },
        )
      ).text()
      const pick = (family: string, weight: string): string | undefined => {
        for (const block of css.split("@font-face")) {
          if (!block.includes(`font-family: '${family}'`) || !block.includes(`font-weight: ${weight}`)) continue
          const m = block.match(/url\((https:[^)]+?\.ttf)\)/)
          if (m) return m[1]
        }
        return undefined
      }
      const serifUrl = pick("Instrument Serif", "400")
      const sansUrl = pick("Instrument Sans", "400")
      const sansBoldUrl = pick("Instrument Sans", "600")
      if (!serifUrl || !sansUrl || !sansBoldUrl) throw new Error("og fonts not found in css")
      const [serif, sans, sansBold] = await Promise.all(
        [serifUrl, sansUrl, sansBoldUrl].map((u) => fetch(u).then((r) => r.arrayBuffer())),
      )
      return {
        serif: Buffer.from(serif),
        sans: Buffer.from(sans),
        sansBold: Buffer.from(sansBold),
      }
    })()
  }
  return fontsPromise
}

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
}

export async function loadPhotoDataUri(src: string | null | undefined): Promise<string | null> {
  if (!src) return null
  try {
    if (src.startsWith("/")) {
      const file = path.join(process.cwd(), "public", src)
      if (existsSync(file)) {
        const ext = path.extname(file).toLowerCase()
        return `data:${MIME[ext] ?? "image/jpeg"};base64,${readFileSync(file).toString("base64")}`
      }
      return null
    }
    if (/^https?:\/\//.test(src)) {
      const res = await fetch(src)
      if (!res.ok) return null
      const type = res.headers.get("content-type")?.split(";")[0] ?? "image/jpeg"
      return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`
    }
    return null
  } catch {
    return null
  }
}

export interface OgCard {
  eyebrow: string
  title: string
  footer: string
  photo: string | null
  photoAlt: string
}

export async function brandOgImage(card: OgCard): Promise<ImageResponse> {
  const fonts = await loadFonts()
  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          backgroundColor: PAPER,
          fontFamily: "Instrument Sans",
          color: INK,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: card.photo ? 640 : W, padding: "64px 56px" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ width: 44, height: 6, backgroundColor: BRAND, borderRadius: 3 }} />
            <div style={{ marginLeft: 16, fontSize: 26, letterSpacing: 2, color: MUTED, textTransform: "uppercase" }}>
              {card.eyebrow}
            </div>
          </div>
          <div style={{ marginTop: 28, fontFamily: "Instrument Serif", fontSize: 72, lineHeight: 1.05 }}>
            {card.title}
          </div>
          <div style={{ marginTop: 28, fontSize: 28, color: MUTED }}>{card.footer}</div>
        </div>
        {card.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.photo}
            alt={card.photoAlt}
            width={560 - 64}
            height={H - 128}
            style={{ margin: "64px 64px 64px 0", objectFit: "cover", borderRadius: 24 }}
          />
        ) : null}
      </div>
    ),
    {
      width: W,
      height: H,
      fonts: [
        { name: "Instrument Serif", data: fonts.serif, weight: 400, style: "normal" },
        { name: "Instrument Sans", data: fonts.sans, weight: 400, style: "normal" },
        { name: "Instrument Sans", data: fonts.sansBold, weight: 600, style: "normal" },
      ],
    },
  )
}
