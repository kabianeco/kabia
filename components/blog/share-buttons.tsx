"use client"

import { useState } from "react"
import { Share2, Link2, Check } from "lucide-react"

/**
 * Share actions built only from the post's own canonical URL and title —
 * both server-provided props, never re-derived from `location` or user
 * input. Prefers the native Web Share API; falls back to copying the URL.
 */
export function ShareButtons({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = useState(false)
  const canShare = typeof navigator !== "undefined" && "share" in navigator

  const share = async () => {
    if (canShare) {
      try {
        await navigator.share({ title, url })
      } catch {
        // Cancelled or unsupported at call time — no action needed.
      }
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable — nothing more to do without a fallback UI.
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="inline-flex min-h-11 items-center gap-2 rounded-theme-button border border-ink/15 px-5 text-sm text-ink/75 transition-colors duration-300 hover:border-brand hover:text-brand"
    >
      {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : canShare ? <Share2 className="h-4 w-4" aria-hidden="true" /> : <Link2 className="h-4 w-4" aria-hidden="true" />}
      {copied ? "Bağlantı kopyalandı" : "Paylaş"}
    </button>
  )
}
