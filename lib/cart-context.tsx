"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth-context"
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
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void
  updateQuantity: (id: string, quantity: number) => void
  removeItem: (id: string) => void
  clearCart: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

const STORAGE_KEY = "kabia_cart"

export const FREE_SHIPPING_THRESHOLD = 500
export const SHIPPING_COST = 29.9

const CART_SELECT =
  "id, quantity, variant_id, product_id, product_variants(label, price), products(slug, name, main_image_url)"

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
  const supabase = createSupabaseBrowserClient()
  const { userId, hydrated: authHydrated } = useAuth()
  const [items, setItems] = useState<CartItem[]>([])
  const [hydrated, setHydrated] = useState(false)
  const cartIdRef = useRef<string | null>(null)

  const ensureCart = useCallback(
    async (uid: string) => {
      let { data: cartRow } = await supabase.from("carts").select("id").eq("user_id", uid).maybeSingle()
      if (!cartRow) {
        const { data: nc } = await supabase.from("carts").insert({ user_id: uid }).select("id").maybeSingle()
        cartRow = nc
      }
      cartIdRef.current = cartRow?.id ?? null
      return cartRow?.id ?? null
    },
    [supabase],
  )

  const loadDbCart = useCallback(
    async (uid: string) => {
      const cid = await ensureCart(uid)
      if (!cid) {
        setItems([])
        return
      }
      const { data: rows } = await supabase.from("cart_items").select(CART_SELECT).eq("cart_id", cid)
      // PostgREST types embedded relations as arrays; both of these are
      // to-one joins and come back as single objects.
      setItems(((rows ?? []) as unknown as CartItemRow[]).map(mapCartRow))
    },
    [supabase, ensureCart],
  )

  const loadGuestCart = useCallback(() => {
    cartIdRef.current = null
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      setItems(raw ? JSON.parse(raw) : [])
    } catch {
      setItems([])
    }
  }, [])

  // Bootstrap + react to auth state (guest <-> authed). Merges guest cart on login.
  useEffect(() => {
    if (!authHydrated) return
    let cancelled = false
    ;(async () => {
      if (userId) {
        // Merge guest localStorage cart into the user's DB cart, then load from DB.
        let guest: CartItem[] = []
        try {
          const raw = localStorage.getItem(STORAGE_KEY)
          if (raw) guest = JSON.parse(raw)
        } catch {
          guest = []
        }
        if (guest.length) {
          const cid = await ensureCart(userId)
          if (cid && !cancelled) {
            for (const gi of guest) {
              const { data: ex } = await supabase
                .from("cart_items")
                .select("id, quantity")
                .eq("cart_id", cid)
                .eq("variant_id", gi.variantId)
                .maybeSingle()
              if (ex) {
                await supabase.from("cart_items").update({ quantity: ex.quantity + gi.quantity }).eq("id", ex.id)
              } else {
                await supabase
                  .from("cart_items")
                  .insert({ cart_id: cid, product_id: gi.productId, variant_id: gi.variantId, quantity: gi.quantity })
              }
            }
            localStorage.removeItem(STORAGE_KEY)
          }
        }
        if (!cancelled) await loadDbCart(userId)
      } else {
        loadGuestCart()
      }
      if (!cancelled) setHydrated(true)
    })()
    return () => {
      cancelled = true
    }
  }, [userId, authHydrated, supabase, ensureCart, loadDbCart, loadGuestCart])

  // Persist guest cart to localStorage
  useEffect(() => {
    if (!hydrated || userId) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items, hydrated, userId])

  const isAuthed = !!userId

  const addItem = useCallback<CartContextValue["addItem"]>(
    (item) => {
      const qty = item.quantity ?? 1
      if (isAuthed && cartIdRef.current) {
        const cid = cartIdRef.current
        const existing = items.find((i) => i.variantId === item.variantId)
        ;(async () => {
          if (existing) {
            const newQty = Math.min(99, existing.quantity + qty)
            await supabase.from("cart_items").update({ quantity: newQty }).eq("cart_id", cid).eq("variant_id", item.variantId)
          } else {
            await supabase
              .from("cart_items")
              .insert({ cart_id: cid, product_id: item.productId, variant_id: item.variantId, quantity: qty })
          }
        })()
      }
      // Optimistic local update
      setItems((prev) => {
        const existing = prev.find((i) => i.id === item.id)
        if (existing) {
          return prev.map((i) => (i.id === item.id ? { ...i, quantity: Math.min(99, i.quantity + qty) } : i))
        }
        return [...prev, { ...item, quantity: qty }]
      })
    },
    [isAuthed, items, supabase],
  )

  const updateQuantity = useCallback(
    (id: string, quantity: number) => {
      const item = items.find((i) => i.id === id)
      if (!item) return
      if (isAuthed && cartIdRef.current) {
        const cid = cartIdRef.current
        ;(async () => {
          if (quantity <= 0) {
            await supabase.from("cart_items").delete().eq("cart_id", cid).eq("variant_id", item.variantId)
          } else {
            await supabase.from("cart_items").update({ quantity }).eq("cart_id", cid).eq("variant_id", item.variantId)
          }
        })()
      }
      setItems((prev) =>
        prev
          .map((i) => (i.id === id ? { ...i, quantity: Math.max(1, Math.min(99, quantity)) } : i))
          .filter((i) => i.quantity > 0),
      )
    },
    [isAuthed, items, supabase],
  )

  const removeItem = useCallback(
    (id: string) => {
      const item = items.find((i) => i.id === id)
      if (item && isAuthed && cartIdRef.current) {
        const cid = cartIdRef.current
        ;(async () => {
          await supabase.from("cart_items").delete().eq("cart_id", cid).eq("variant_id", item.variantId)
        })()
      }
      setItems((prev) => prev.filter((i) => i.id !== id))
    },
    [isAuthed, items, supabase],
  )

  const clearCart = useCallback(() => {
    if (isAuthed && cartIdRef.current) {
      const cid = cartIdRef.current
      ;(async () => {
        await supabase.from("cart_items").delete().eq("cart_id", cid)
      })()
    }
    setItems([])
  }, [isAuthed, supabase])


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
