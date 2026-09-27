"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth-context"
import { hasPreviewItems, isPreviewItem } from "@/lib/preview-identity"
import { clampCartQuantity } from "@/lib/cart-quantity"
import {
  GUEST_CART_STORAGE_KEY,
  nextGuestCartAfterAdd,
  nextGuestCartAfterQuantity,
  readGuestCart,
  writeGuestCart,
} from "@/lib/cart-storage"
import type { CartItemRow } from "@/lib/supabase/rows"

export interface CartItem {
  id: string // `${slug}__${variant}` — UI key
  slug: string
  name: string
  variant: string
  price: number
  quantity: number
  image: string
  variantId: string // DB product_variants.id
  productId: string // DB products.id
}

interface CartContextValue {
  items: CartItem[]
  itemCount: number
  subtotal: number
  hydrated: boolean
  /** Resolves true only after the write is confirmed (DB for signed-in, storage for guest). False means nothing was saved — callers must show an error, never navigate as if it succeeded. */
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => Promise<boolean>
  updateQuantity: (id: string, quantity: number) => void
  removeItem: (id: string) => void
  clearCart: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

const STORAGE_KEY = GUEST_CART_STORAGE_KEY

export const FREE_SHIPPING_THRESHOLD = 2000
// HepsiJet anlaşması: 4 desiye kadar sabit ücret. Değişirse tek yerden değişir.
export const SHIPPING_COST = 107.91

const CART_SELECT =
  "id, quantity, variant_id, product_id, product_variants!cart_items_variant_id_fkey(label, price), products(slug, name, main_image_url)"

function mapCartRow(r: CartItemRow): CartItem {
  const v = r.product_variants
  const p = r.products
  return {
    id: `${p.slug}__${v.label}`,
    slug: p.slug,
    name: p.name,
    variant: v.label,
    price: Number(v.price),
    quantity: r.quantity,
    image: p.main_image_url,
    variantId: r.variant_id,
    productId: r.product_id,
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  // §8.3: no render-time client — every DB call below awaits the lazily
  // loaded browser client inside its own async closure.
  const { userId, hydrated: authHydrated } = useAuth()
  const [items, setItems] = useState<CartItem[]>([])
  const [hydrated, setHydrated] = useState(false)
  const cartIdRef = useRef<string | null>(null)
  // Handlers created before an auth transition must use current authority.
  const authority = useRef({ userId, authHydrated })
  // eslint-disable-next-line react-hooks/refs -- intentional latest-value ref: async cart handlers compare against the current authority (both reviewers cleared this pattern).
  authority.current = { userId, authHydrated }
  // Misafir yazımlarının effect beklenmeden senkron kalıcı olması için
  // state'in ref aynası: hızlı ardışık eklemelerde stale closure kaybını önler.
  const itemsRef = useRef<CartItem[]>([])
  const setItemsSync = useCallback((next: CartItem[] | ((prev: CartItem[]) => CartItem[])) => {
    const resolved = typeof next === "function" ? (next as (prev: CartItem[]) => CartItem[])(itemsRef.current) : next
    itemsRef.current = resolved
    setItems(resolved)
    // Misafir ise aynı tick'te localStorage'a yaz: tam sayfa yenilemesi
    // (toast "Sepete git") effect'i beklemez.
    if (!authority.current.userId) writeGuestCart(resolved)
  }, [])
  const [loadedFor, setLoadedFor] = useState<string | null | undefined>(undefined)

  const ensureCart = useCallback(
    async (uid: string) => {
      const supabase = await getSupabaseBrowserClient()
      let { data: cartRow } = await supabase.from("carts").select("id").eq("user_id", uid).maybeSingle()
      if (!cartRow && authority.current.userId === uid) {
        const { data: nc } = await supabase.from("carts").insert({ user_id: uid }).select("id").maybeSingle()
        cartRow = nc
      }
      cartIdRef.current = cartRow?.id ?? null
      return cartRow?.id ?? null
    },
    [],
  )

  const loadDbCart = useCallback(
    async (uid: string) => {
      const supabase = await getSupabaseBrowserClient()
      const { data: cartRow } = await supabase.from("carts").select("id").eq("user_id", uid).maybeSingle()
      if (authority.current.userId !== uid) return
      const cid = cartRow?.id ?? null
      cartIdRef.current = cid
      if (!cid) {
        itemsRef.current = []
        setItems([])
        return
      }
      const { data: rows } = await supabase.from("cart_items").select(CART_SELECT).eq("cart_id", cid)
      // PostgREST types embedded relations as arrays; both of these are
      // to-one joins and come back as single objects.
      if (authority.current.userId === uid) {
        const next = ((rows ?? []) as unknown as CartItemRow[]).map(mapCartRow).filter((item) => !isPreviewItem(item))
        itemsRef.current = next
        setItems(next)
      }
    },
    [],
  )

  const loadGuestCart = useCallback(() => {
    cartIdRef.current = null
    // Senkron okuma + sterilize: readGuestCart ile aynı davranış.
    const next = readGuestCart(localStorage.getItem(STORAGE_KEY))
    itemsRef.current = next
    setItems(next)
  }, [])

  // Bootstrap + react to auth state (guest <-> authed). Merges guest cart on login.
  useEffect(() => {
    if (!authHydrated) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional transition reset: marks unhydrated exactly once per auth change, guarded by `cancelled` below.
    setHydrated(false)
    cartIdRef.current = null
    let cancelled = false
    ;(async () => {
      const supabase = await getSupabaseBrowserClient()
      if (userId) {
        // Merge guest localStorage cart into the user's DB cart, then load from DB.
        let guest: CartItem[] = []
        try {
          const raw = localStorage.getItem(STORAGE_KEY)
          if (raw) guest = JSON.parse(raw)
        } catch {
          guest = []
        }
        const previewGuest = guest.filter(isPreviewItem)
        guest = guest.filter((item) => !isPreviewItem(item))
        if (guest.length) {
          const cid = await ensureCart(userId)
          if (cid && !cancelled) {
            for (const gi of guest) {
              if (cancelled || authority.current.userId !== userId) break
              const { data: ex } = await supabase
                .from("cart_items")
                .select("id, quantity")
                .eq("cart_id", cid)
                .eq("variant_id", gi.variantId)
                .maybeSingle()
              if (cancelled || authority.current.userId !== userId) break
              if (ex) {
                await supabase.from("cart_items").update({ quantity: clampCartQuantity(ex.quantity + gi.quantity) }).eq("id", ex.id)
              } else {
                await supabase
                  .from("cart_items")
                  .insert({ cart_id: cid, product_id: gi.productId, variant_id: gi.variantId, quantity: clampCartQuantity(gi.quantity) })
              }
            }
            if (!cancelled) localStorage.setItem(STORAGE_KEY, JSON.stringify(previewGuest))
          }
        }
        if (!cancelled) await loadDbCart(userId)
      } else {
        loadGuestCart()
      }
      if (!cancelled) { setLoadedFor(userId); setHydrated(true) }
    })()
    return () => {
      cancelled = true
    }
  }, [userId, authHydrated, ensureCart, loadDbCart, loadGuestCart])

  // Persist guest cart to localStorage (yedek: birincil yazım artık
  // setItemsSync içinde senkron yapılır, bu effect yalnızca güvence).
  useEffect(() => {
    if (!hydrated || !authHydrated || userId || loadedFor !== null) return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const serialized = JSON.stringify(items)
      if (raw !== serialized) localStorage.setItem(STORAGE_KEY, serialized)
    } catch {
      // Yoksay: birincil yazım zaten denendi.
    }
  }, [items, hydrated, userId, authHydrated, loadedFor])

  const addItem = useCallback<CartContextValue["addItem"]>(
    async (item) => {
      const auth = authority.current
      if (!auth.authHydrated || (isPreviewItem(item) && auth.userId)) return false
      const qty = clampCartQuantity(item.quantity ?? 1)
      if (!auth.userId) {
        // Guest: synchronous localStorage persistence survives a full reload in the same tick.
        setItemsSync((prev) => nextGuestCartAfterAdd(prev, { ...item, quantity: qty }))
        return true
      }
      const uid = auth.userId
      try {
        const supabase = await getSupabaseBrowserClient()
        const cid = cartIdRef.current ?? await ensureCart(uid)
        if (!cid || authority.current.userId !== uid) return false
        const existing = itemsRef.current.find((i) => i.variantId === item.variantId)
        if (existing) {
          const newQty = Math.min(99, existing.quantity + qty)
          const { error } = await supabase
            .from("cart_items")
            .update({ quantity: newQty })
            .eq("cart_id", cid)
            .eq("variant_id", item.variantId)
          if (error) return false
        } else {
          const { error: insertError } = await supabase.from("cart_items").insert({
            cart_id: cid,
            product_id: item.productId,
            variant_id: item.variantId,
            quantity: qty,
          })
          if (insertError) {
            // A concurrent add (or a reload that re-hydrated from the DB)
            // created the row first: sum onto the stored quantity instead of
            // dropping the add. Any other rejection surfaces as failure.
            const { data: current } = await supabase
              .from("cart_items")
              .select("quantity")
              .eq("cart_id", cid)
              .eq("variant_id", item.variantId)
              .maybeSingle()
            const base = typeof (current as { quantity?: unknown } | null)?.quantity === "number"
              ? ((current as { quantity: number }).quantity)
              : 0
            if (!base) return false
            const { error: mergeError } = await supabase
              .from("cart_items")
              .update({ quantity: Math.min(99, base + qty) })
              .eq("cart_id", cid)
              .eq("variant_id", item.variantId)
            if (mergeError) return false
          }
        }
      } catch {
        return false
      }
      // The database confirmed the write — only now reflect it in memory.
      // A rejected write never produces a phantom item.
      setItemsSync((prev) => nextGuestCartAfterAdd(prev, { ...item, quantity: qty }))
      return true
    },
    [ensureCart, setItemsSync],
  )

  const updateQuantity = useCallback(
    (id: string, quantity: number) => {
      const item = itemsRef.current.find((i) => i.id === id)
      if (!item || (isPreviewItem(item) && (!authority.current.authHydrated || authority.current.userId))) return
      if (!isPreviewItem(item) && authority.current.userId && cartIdRef.current) {
        const cid = cartIdRef.current
        ;(async () => {
          const supabase = await getSupabaseBrowserClient()
          if (quantity <= 0) {
            await supabase.from("cart_items").delete().eq("cart_id", cid).eq("variant_id", item.variantId)
          } else {
            await supabase.from("cart_items").update({ quantity: clampCartQuantity(quantity) }).eq("cart_id", cid).eq("variant_id", item.variantId)
          }
        })()
      }
      setItemsSync((prev) => nextGuestCartAfterQuantity(prev, id, quantity <= 0 ? 0 : clampCartQuantity(quantity)))
    },
    [setItemsSync],
  )

  const removeItem = useCallback(
    (id: string) => {
      const item = itemsRef.current.find((i) => i.id === id)
      if (item && !isPreviewItem(item) && authority.current.userId && cartIdRef.current) {
        const cid = cartIdRef.current
        ;(async () => {
          const supabase = await getSupabaseBrowserClient()
          await supabase.from("cart_items").delete().eq("cart_id", cid).eq("variant_id", item.variantId)
        })()
      }
      setItemsSync((prev) => prev.filter((i) => i.id !== id))
    },
    [setItemsSync],
  )

  const clearCart = useCallback(() => {
    if (!hasPreviewItems(itemsRef.current) && authority.current.userId && cartIdRef.current) {
      const cid = cartIdRef.current
      ;(async () => {
        const supabase = await getSupabaseBrowserClient()
        await supabase.from("cart_items").delete().eq("cart_id", cid)
      })()
    }
    setItemsSync([])
  }, [setItemsSync])


  const itemCount = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items])
  const subtotal = useMemo(() => items.reduce((sum, i) => sum + i.price * i.quantity, 0), [items])

  const value: CartContextValue = {
    items,
    itemCount,
    subtotal,
    hydrated,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error("useCart must be used within a CartProvider")
  return ctx
}
