"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth-context"
import type { PaymentMethodRow } from "@/lib/supabase/rows"

export type CardBrand = "visa" | "mastercard" | "troy" | null

export interface SavedCard {
  id: string
  brand: CardBrand
  last4: string
  expiry: string // MM/YY
  cardName: string
  isDefault: boolean
}

interface CardsContextValue {
  cards: SavedCard[]
  addCard: (card: Omit<SavedCard, "id" | "isDefault">) => Promise<void>
  removeCard: (id: string) => Promise<void>
  setDefaultCard: (id: string) => Promise<void>
  hydrated: boolean
}

const CardsContext = createContext<CardsContextValue | null>(null)

const STORAGE_KEY = "kabia_cards"

function mapRow(r: PaymentMethodRow): SavedCard {
  const mm = r.expiry_month ? String(r.expiry_month).padStart(2, "0") : ""
  const yy = r.expiry_year ? String(r.expiry_year).slice(-2) : ""
  return {
    id: r.id,
    brand: (r.card_brand as CardBrand) ?? null,
    last4: r.last4 ?? "",
    expiry: mm && yy ? `${mm}/${yy}` : "",
    cardName: r.card_name ?? "",
    isDefault: r.is_default ?? false,
  }
}

function splitExpiry(expiry: string) {
  const [mm, yy] = expiry.split("/")
  return { expiry_month: mm ? Number(mm) : null, expiry_year: yy ? Number(yy) : null }
}

export function CardsProvider({ children }: { children: ReactNode }) {
  const supabase = createSupabaseBrowserClient()
  const { userId, hydrated: authHydrated } = useAuth()
  const [cards, setCards] = useState<SavedCard[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (!authHydrated) return
    let cancelled = false
    ;(async () => {
      if (userId) {
        let guest: SavedCard[] = []
        try {
          const raw = localStorage.getItem(STORAGE_KEY)
          if (raw) guest = JSON.parse(raw)
        } catch {
          guest = []
        }
        for (const g of guest) {
          await supabase.from("payment_methods").insert({
            user_id: userId,
            card_brand: g.brand,
            last4: g.last4,
            ...splitExpiry(g.expiry),
            card_name: g.cardName,
            is_default: g.isDefault,
          })
        }
        if (guest.length) localStorage.removeItem(STORAGE_KEY)
        const { data } = await supabase.from("payment_methods").select("*").order("created_at", { ascending: false })
        if (!cancelled) setCards((data ?? []).map(mapRow))
      } else {
        try {
          const raw = localStorage.getItem(STORAGE_KEY)
          if (!cancelled) setCards(raw ? JSON.parse(raw) : [])
        } catch {
          if (!cancelled) setCards([])
        }
      }
      if (!cancelled) setHydrated(true)
    })()
    return () => {
      cancelled = true
    }
  }, [userId, authHydrated, supabase])

  useEffect(() => {
    if (hydrated && !userId) localStorage.setItem(STORAGE_KEY, JSON.stringify(cards))
  }, [cards, hydrated, userId])

  const addCard = useCallback(
    async (card: Omit<SavedCard, "id" | "isDefault">) => {
      // Only last4/expiry/brand/cardName ever reach here — full PAN/CVV discarded by the form.
      if (userId) {
        const { data } = await supabase
          .from("payment_methods")
          .insert({
            user_id: userId,
            card_brand: card.brand,
            last4: card.last4,
            ...splitExpiry(card.expiry),
            card_name: card.cardName,
          })
          .select("*")
          .maybeSingle()
        if (data) setCards((prev) => [...prev, mapRow(data)])
      } else {
        const id = `card_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
        setCards((prev) => [...prev, { ...card, id, isDefault: prev.length === 0 }])
      }
    },
    [userId, supabase],
  )

  const removeCard = useCallback(
    async (id: string) => {
      if (userId) await supabase.from("payment_methods").delete().eq("id", id)
      setCards((prev) => prev.filter((c) => c.id !== id))
    },
    [userId, supabase],
  )

  const setDefaultCard = useCallback(
    async (id: string) => {
      if (userId) {
        await supabase.from("payment_methods").update({ is_default: false }).neq("id", id)
        await supabase.from("payment_methods").update({ is_default: true }).eq("id", id)
      }
      setCards((prev) => prev.map((c) => ({ ...c, isDefault: c.id === id })))
    },
    [userId, supabase],
  )

  const value = useMemo(
    () => ({ cards, addCard, removeCard, setDefaultCard, hydrated }),
    [cards, addCard, removeCard, setDefaultCard, hydrated],
  )

  return <CardsContext.Provider value={value}>{children}</CardsContext.Provider>
}

export function useCards() {
  const ctx = useContext(CardsContext)
  if (!ctx) throw new Error("useCards must be used within a CardsProvider")
  return ctx
}
