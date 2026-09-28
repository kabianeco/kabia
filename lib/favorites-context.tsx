"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { toast } from "sonner"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth-context"
import { isPreviewItem } from "@/lib/preview-identity"
import type { FavoriteRow } from "@/lib/supabase/rows"

interface FavoritesContextValue {
  favoriteSlugs: string[]
  isFavorite: (slug: string) => boolean
  toggleFavorite: (slug: string) => void
  hydrated: boolean
  /** True when the signed-in list could not be read — distinct from "none". */
  error: boolean
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null)

const STORAGE_KEY = "kabia_favorites"

export function FavoritesProvider({ children }: { children: ReactNode }) {
  // §8.3: no render-time client — acquired inside async work only.
  const { userId, hydrated: authHydrated } = useAuth()
  const [favoriteSlugs, setFavoriteSlugs] = useState<string[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!authHydrated) return
    let cancelled = false
    ;(async () => {
      // Guests never need the browser client: their state is localStorage.
      if (userId) {
        const supabase = await getSupabaseBrowserClient()
        if (cancelled) return
        // merge guest favorites into DB
        let guest: string[] = []
        try {
          const raw = localStorage.getItem(STORAGE_KEY)
          if (raw) guest = JSON.parse(raw).filter((slug: string) => !isPreviewItem({ slug }))
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
        const { data, error: readError } = await supabase.from("favorites").select("product_id, products(slug)").eq("user_id", userId)
        if (!cancelled) setError(!!readError)
        if (!cancelled && !readError) setFavoriteSlugs(
            ((data ?? []) as unknown as FavoriteRow[])
              .map((r) => r.products?.slug)
              .filter((s): s is string => !!s && !isPreviewItem({ slug: s })),
          )
      } else {
        try {
          const raw = localStorage.getItem(STORAGE_KEY)
          if (!cancelled) setFavoriteSlugs(raw ? JSON.parse(raw).filter((slug: string) => !isPreviewItem({ slug })) : [])
        } catch {
          if (!cancelled) setFavoriteSlugs([])
        }
      }
      if (!cancelled) setHydrated(true)
    })()
    return () => {
      cancelled = true
    }
  }, [userId, authHydrated])

  useEffect(() => {
    if (hydrated && !userId) localStorage.setItem(STORAGE_KEY, JSON.stringify(favoriteSlugs))
  }, [favoriteSlugs, hydrated, userId])

  const isFavorite = useCallback((slug: string) => favoriteSlugs.includes(slug), [favoriteSlugs])

  const toggleFavorite = useCallback(
    (slug: string) => {
      if (isPreviewItem({ slug })) return
      setFavoriteSlugs((prev) => {
        const next = prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
        return next
      })
      if (userId) {
        ;(async () => {
          const supabase = await getSupabaseBrowserClient()
          const isFav = favoriteSlugs.includes(slug)
          const { data: prod } = await supabase.from("products").select("id").eq("slug", slug).maybeSingle()
          const { error: writeError } = !prod
            ? { error: true }
            : isFav
              // S26: owner-scoped delete — never by product alone.
              ? await supabase.from("favorites").delete().eq("product_id", prod.id).eq("user_id", userId)
              : await supabase.from("favorites").upsert({ user_id: userId, product_id: prod.id }, { onConflict: "user_id,product_id" })
          if (writeError) {
            // The optimistic change did not stick: put the list back as it was.
            setFavoriteSlugs((prev) => (isFav ? [...prev.filter((s) => s !== slug), slug] : prev.filter((s) => s !== slug)))
            toast.error("Favorileriniz güncellenemedi. Lütfen tekrar deneyin.")
          }
        })()
      }
    },
    [favoriteSlugs, userId],
  )

  const value = useMemo(
    () => ({ favoriteSlugs, isFavorite, toggleFavorite, hydrated, error }),
    [favoriteSlugs, isFavorite, toggleFavorite, hydrated, error],
  )

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext)
  if (!ctx) throw new Error("useFavorites must be used within a FavoritesProvider")
  return ctx
}
