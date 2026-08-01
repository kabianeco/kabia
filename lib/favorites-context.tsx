"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth-context"
import type { FavoriteRow } from "@/lib/supabase/rows"

interface FavoritesContextValue {
  favoriteSlugs: string[]
  isFavorite: (slug: string) => boolean
  toggleFavorite: (slug: string) => void
  hydrated: boolean
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null)

const STORAGE_KEY = "kabia_favorites"

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const supabase = createSupabaseBrowserClient()
  const { userId, hydrated: authHydrated } = useAuth()
  const [favoriteSlugs, setFavoriteSlugs] = useState<string[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (!authHydrated) return
    let cancelled = false
    ;(async () => {
      if (userId) {
        // merge guest favorites into DB
        let guest: string[] = []
        try {
          const raw = localStorage.getItem(STORAGE_KEY)
          if (raw) guest = JSON.parse(raw)
        } catch {
          guest = []
        }
        if (guest.length) {
          const { data: prods } = await supabase.from("products").select("id, slug").in("slug", guest)
          for (const p of prods ?? []) {
            await supabase.from("favorites").upsert({ user_id: userId, product_id: p.id }, { onConflict: "user_id,product_id" }).then(() => {})
          }
          localStorage.removeItem(STORAGE_KEY)
        }
        const { data } = await supabase.from("favorites").select("product_id, products(slug)")
        if (!cancelled) setFavoriteSlugs(
            ((data ?? []) as unknown as FavoriteRow[])
              .map((r) => r.products?.slug)
              .filter((s): s is string => !!s),
          )
      } else {
        try {
          const raw = localStorage.getItem(STORAGE_KEY)
          if (!cancelled) setFavoriteSlugs(raw ? JSON.parse(raw) : [])
        } catch {
          if (!cancelled) setFavoriteSlugs([])
        }
      }
      if (!cancelled) setHydrated(true)
    })()
    return () => {
      cancelled = true
    }
  }, [userId, authHydrated, supabase])

  useEffect(() => {
    if (hydrated && !userId) localStorage.setItem(STORAGE_KEY, JSON.stringify(favoriteSlugs))
  }, [favoriteSlugs, hydrated, userId])

  const isFavorite = useCallback((slug: string) => favoriteSlugs.includes(slug), [favoriteSlugs])

  const toggleFavorite = useCallback(
    (slug: string) => {
      setFavoriteSlugs((prev) => {
        const next = prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
        return next
      })
      if (userId) {
        ;(async () => {
          const { data: prod } = await supabase.from("products").select("id").eq("slug", slug).maybeSingle()
          if (!prod) return
          const isFav = favoriteSlugs.includes(slug)
          if (isFav) {
            await supabase.from("favorites").delete().eq("product_id", prod.id)
          } else {
            await supabase.from("favorites").upsert({ user_id: userId, product_id: prod.id }, { onConflict: "user_id,product_id" })
          }
        })()
      }
    },
    [favoriteSlugs, userId, supabase],
  )

  const value = useMemo(
    () => ({ favoriteSlugs, isFavorite, toggleFavorite, hydrated }),
    [favoriteSlugs, isFavorite, toggleFavorite, hydrated],
  )

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext)
  if (!ctx) throw new Error("useFavorites must be used within a FavoritesProvider")
  return ctx
}
