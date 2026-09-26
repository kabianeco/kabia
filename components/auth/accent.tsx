import type { ReactNode } from "react"

/** The storefront's heading idiom: plain words, the key one in the italic display face. */
export function Accent({ children }: { children: ReactNode }) {
  return <em className="font-theme-display italic text-brand">{children}</em>
}
