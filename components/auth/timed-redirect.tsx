"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ButtonLink } from "@/components/ui/button"

/** Keyboard focus cancels the automatic navigation so controls remain usable. */
export function TimedRedirect({ href, label }: { href: string; label: string }) {
  const router = useRouter()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (!paused) timer.current = setTimeout(() => router.replace(href), 5000)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [href, paused, router])

  return (
    <div onFocusCapture={() => setPaused(true)} onKeyDownCapture={() => setPaused(true)}>
      <p role="status" aria-live="polite" className="mb-7 text-sm text-ink/65">
        {paused ? "Otomatik yönlendirme durduruldu." : "Beş saniye içinde yönlendirileceksiniz."}
      </p>
      <ButtonLink href={href} size="lg">{label}</ButtonLink>
    </div>
  )
}
