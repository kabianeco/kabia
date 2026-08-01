"use client"

import { useState } from "react"
import { MediaThumb } from "@/components/admin/media/media-thumb"
import { MediaPreviewDialog } from "@/components/admin/media/media-preview-dialog"
import { EmptyState } from "@/components/admin/ui/surfaces"
import {
  formatBytes,
  formatDimensions,
  MEDIA_MIME_LABELS,
  type MediaAsset,
  type MediaUsage,
} from "@/lib/admin/media"
import { cn } from "@/lib/utils"

export { MediaUploader } from "@/components/admin/media/media-uploader"

/**
 * The library grid.
 *
 * Every tile is a button rather than a div with a click handler, so the grid is
 * traversable with Tab and activates with Enter or Space without any key
 * handling of its own. Usage is shown on the tile itself — an image a product
 * depends on should look different before anyone opens it, not only once they
 * try to delete it.
 */
export function MediaGrid({
  assets,
  usage,
}: {
  assets: MediaAsset[]
  usage: Record<string, MediaUsage[]>
}) {
  const [selected, setSelected] = useState<MediaAsset | null>(null)

  if (assets.length === 0) {
    return (
      <EmptyState
        title="Görsel bulunamadı"
        description="Yüklediğiniz görseller burada listelenir ve ürün düzenleme ekranından seçilebilir."
      />
    )
  }

  return (
    <>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {assets.map((asset) => {
          const used = usage[asset.id] ?? []
          return (
            <li key={asset.id}>
              <button
                type="button"
                onClick={() => setSelected(asset)}
                className="group block w-full overflow-hidden rounded-[4px] border border-ink/10 bg-paper/50 text-left transition-colors duration-200 hover:border-brand/40 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-brand"
              >
                <span className="relative block aspect-[4/3] bg-ink/[0.05]">
                  <MediaThumb asset={asset} />
                </span>

                <span className="block p-3">
                  <span className="block truncate text-sm text-ink" title={asset.label}>
                    {asset.label}
                  </span>
                  <span className="mt-1 block text-xs text-ink/45">
                    {MEDIA_MIME_LABELS[asset.mimeType] ?? asset.mimeType} ·{" "}
                    {formatBytes(asset.fileSize)}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink/40">
                    {formatDimensions(asset.width, asset.height)}
                  </span>
                  <span
                    className={cn(
                      "mt-2 block text-xs",
                      used.length > 0 ? "text-olive" : "text-ink/35",
                    )}
                  >
                    {used.length > 0
                      ? `${used.length} üründe kullanılıyor`
                      : "Kullanılmıyor"}
                  </span>
                  {!asset.altText && (
                    <span className="mt-1 block text-xs text-clay/80">Alt metni eksik</span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <MediaPreviewDialog
        asset={selected}
        usage={selected ? (usage[selected.id] ?? []) : []}
        open={selected !== null}
        onClose={() => setSelected(null)}
      />
    </>
  )
}
