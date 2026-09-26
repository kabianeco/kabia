"use client"

import { useEffect, type ReactNode } from "react"

/**
 * Saved cards are retired. The old "Kartlarım" form asked for a full card
 * number and CVV but could only keep brand, last four digits and expiry —
 * nothing a payment could ever be made with — so card entry is gone and
 * nothing here reads or writes public.payment_methods any more. Existing rows
 * are left in place (counted in the Phase 2 report), included in the personal
 * data export, and removed with the account.
 *
 * The provider remains only so existing trees keep their shape; its one job
 * is to delete card details a guest may have left in this browser under the
 * old implementation.
 */
const LEGACY_STORAGE_KEY = "kabia_cards"

export function CardsProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY)
    } catch {}
  }, [])
  return <>{children}</>
}
