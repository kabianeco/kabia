import Image from "next/image"
import { cn } from "@/lib/utils"
import type { MediaAsset } from "@/lib/admin/media"

/**
 * The one place a library thumbnail is rendered.
 *
 * `sizes` matters more than it looks: without it next/image would request an
 * image sized for the full viewport for every tile in the grid, which on a
 * 24-tile page of 10 MB originals is tens of megabytes of needless transfer.
 * The declared sizes track the grid's own breakpoints, so each tile downloads
 * roughly the pixels it displays.
 *
 * `loading="lazy"` is the default and is left in place deliberately — only
 * tiles scrolled into view are ever fetched.
 */
export function MediaThumb({
  asset,
  className,
  sizes = "(min-width: 1280px) 12rem, (min-width: 768px) 20vw, 45vw",
  priority = false,
}: {
  asset: Pick<MediaAsset, "url" | "altText" | "label">
  className?: string
  sizes?: string
  priority?: boolean
}) {
  return (
    <Image
      src={asset.url}
      // Alt text is the operator's if they set one. When they have not, the
      // image is decorative *in this context* — the filename is already shown
      // as text beside it, so repeating it here would only make a screen reader
      // say the same thing twice.
      alt={asset.altText ?? ""}
      fill
      sizes={sizes}
      priority={priority}
      className={cn("object-cover", className)}
    />
  )
}
