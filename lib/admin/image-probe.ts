/**
 * Container sniffing for the four image formats this store accepts.
 *
 * Two jobs, both of which need the actual bytes rather than what the browser
 * claimed:
 *
 *   1. Decide the real format. `file.type` is attacker-controlled — it is
 *      whatever the multipart body said — and the extension is worse. A .png
 *      that is really an HTML document with a <script> in it would be served
 *      from the same origin-adjacent Storage host as everything else, so the
 *      declared type is checked *against the leading bytes* before anything is
 *      written.
 *
 *   2. Read the intrinsic dimensions, so the library can show them and the
 *      storefront can reserve layout space.
 *
 * Only headers are parsed — never the pixel data — so this stays O(1) on file
 * size and cannot be turned into a decompression bomb. Anything it does not
 * positively recognise is rejected rather than waved through.
 *
 * SVG is absent on purpose: it is a script-execution vector and nothing in this
 * application sanitises it.
 */

export type ProbedFormat = "image/jpeg" | "image/png" | "image/webp" | "image/avif"

export interface ProbeResult {
  format: ProbedFormat
  width: number | null
  height: number | null
}

const ascii = (view: DataView, offset: number, length: number): string => {
  let out = ""
  for (let i = 0; i < length; i++) out += String.fromCharCode(view.getUint8(offset + i))
  return out
}

function probePng(view: DataView): ProbeResult | null {
  // 89 50 4E 47 0D 0A 1A 0A, then an IHDR chunk whose payload starts at 16.
  if (view.byteLength < 24) return null
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  for (let i = 0; i < 8; i++) if (view.getUint8(i) !== signature[i]) return null
  if (ascii(view, 12, 4) !== "IHDR") return null
  return { format: "image/png", width: view.getUint32(16), height: view.getUint32(20) }
}

function probeJpeg(view: DataView): ProbeResult | null {
  if (view.byteLength < 4) return null
  if (view.getUint8(0) !== 0xff || view.getUint8(1) !== 0xd8) return null

  // Walk the marker segments looking for a Start Of Frame, which is the only
  // place the true dimensions live. Everything else (EXIF, comments, quant
  // tables) is skipped by its declared length.
  let offset = 2
  while (offset + 9 < view.byteLength) {
    if (view.getUint8(offset) !== 0xff) {
      offset++ // fill byte or desynchronised stream; resynchronise
      continue
    }
    const marker = view.getUint8(offset + 1)
    // Standalone markers carry no length payload.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2
      continue
    }
    if (marker === 0xda || marker === 0xd9) break // start of scan / end of image
    const length = view.getUint16(offset + 2)
    if (length < 2) break
    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    if (isSof) {
      return {
        format: "image/jpeg",
        height: view.getUint16(offset + 5),
        width: view.getUint16(offset + 7),
      }
    }
    offset += 2 + length
  }
  // A valid SOI with no readable frame header: accept the format, admit the
  // dimensions are unknown rather than guessing.
  return { format: "image/jpeg", width: null, height: null }
}

function probeWebp(view: DataView): ProbeResult | null {
  if (view.byteLength < 30) return null
  if (ascii(view, 0, 4) !== "RIFF" || ascii(view, 8, 4) !== "WEBP") return null

  const chunk = ascii(view, 12, 4)

  if (chunk === "VP8 ") {
    // Lossy: 3-byte frame tag, 3-byte start code, then 14-bit width/height.
    if (view.byteLength < 30) return null
    return {
      format: "image/webp",
      width: view.getUint16(26, true) & 0x3fff,
      height: view.getUint16(28, true) & 0x3fff,
    }
  }

  if (chunk === "VP8L") {
    // Lossless: signature byte 0x2f, then 14 bits width and 14 bits height
    // packed little-endian, each stored as value-1.
    if (view.getUint8(20) !== 0x2f) return null
    const bits = view.getUint32(21, true)
    return {
      format: "image/webp",
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    }
  }

  if (chunk === "VP8X") {
    // Extended: canvas size stored as three-byte little-endian value-1 pairs.
    const width = 1 + (view.getUint8(24) | (view.getUint8(25) << 8) | (view.getUint8(26) << 16))
    const height = 1 + (view.getUint8(27) | (view.getUint8(28) << 8) | (view.getUint8(29) << 16))
    return { format: "image/webp", width, height }
  }

  return { format: "image/webp", width: null, height: null }
}

function probeAvif(view: DataView): ProbeResult | null {
  // ISOBMFF: a 4-byte box length, then 'ftyp', then the major brand.
  if (view.byteLength < 16) return null
  if (ascii(view, 4, 4) !== "ftyp") return null
  const brand = ascii(view, 8, 4)
  const compatible = brand === "avif" || brand === "avis" || brand === "mif1"
  if (!compatible) return null

  // Dimensions live in an 'ispe' property box. Rather than walk the full box
  // tree, scan the header region for the marker — ispe carries its width and
  // height as two big-endian uint32s immediately after a 4-byte version/flags.
  for (let i = 16; i + 20 < view.byteLength; i++) {
    if (ascii(view, i, 4) === "ispe") {
      return {
        format: "image/avif",
        width: view.getUint32(i + 8),
        height: view.getUint32(i + 12),
      }
    }
  }
  return { format: "image/avif", width: null, height: null }
}

/**
 * Returns the format the bytes actually are, or null when they are not one of
 * the four accepted image containers. Never throws on malformed input.
 */
export function probeImage(bytes: ArrayBuffer): ProbeResult | null {
  try {
    const view = new DataView(bytes)
    return (
      probePng(view) ?? probeJpeg(view) ?? probeWebp(view) ?? probeAvif(view) ?? null
    )
  } catch {
    return null
  }
}

/** How much of the file the probes above need. Headers only. */
export const PROBE_BYTES = 64 * 1024
