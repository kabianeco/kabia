"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth-context"
import type { AddressRow } from "@/lib/supabase/rows"

export interface SavedAddress {
  id: string
  label: string
  recipientName: string
  phone: string
  addressLine1: string
  addressLine2: string
  city: string
  district: string
  postalCode: string
  isDefault?: boolean
}

interface ContactInfo {
  fullName: string
  email: string
  phone: string
}

interface CheckoutContextValue extends ContactInfo {
  setContact: (patch: Partial<ContactInfo>) => void
  addresses: SavedAddress[]
  selectedAddressId: string | null
  defaultAddressId: string | null
  selectAddress: (id: string) => void
  /** Each write resolves false when the database rejected it; state is unchanged then. */
  addAddress: (address: Omit<SavedAddress, "id">) => Promise<boolean>
  updateAddress: (id: string, patch: Omit<SavedAddress, "id">) => Promise<boolean>
  removeAddress: (id: string) => Promise<boolean>
  setDefaultAddress: (id: string) => Promise<boolean>
  getSelectedAddress: () => SavedAddress | null
  hydrated: boolean
  /** True when the signed-in address list could not be read — distinct from "none". */
  loadError: boolean
}

const CheckoutContext = createContext<CheckoutContextValue | null>(null)

const CONTACT_KEY = "kabia_contact"
const GUEST_ADDR_KEY = "kabia_addresses"
const SELECTED_KEY = "kabia_selected_address"

const EMPTY_CONTACT: ContactInfo = { fullName: "", email: "", phone: "" }

function readStoredContact(): ContactInfo {
  if (typeof window === "undefined") return EMPTY_CONTACT
  try {
    const raw = localStorage.getItem(CONTACT_KEY)
    return raw ? { ...EMPTY_CONTACT, ...JSON.parse(raw) } : EMPTY_CONTACT
  } catch {
    return EMPTY_CONTACT
  }
}

function readStoredSelectedAddress(): string | null {
  if (typeof window === "undefined") return null
  try {
    return localStorage.getItem(SELECTED_KEY)
  } catch {
    return null
  }
}

function mapAddrRow(r: AddressRow): SavedAddress {
  return {
    id: r.id,
    label: r.label,
    recipientName: r.full_name,
    phone: r.phone,
    addressLine1: r.address_line1,
    addressLine2: r.address_line2 ?? "",
    city: r.city,
    district: r.district,
    postalCode: r.postal_code,
    isDefault: r.is_default,
  }
}

function toDbRow(a: Omit<SavedAddress, "id">, uid: string) {
  return {
    user_id: uid,
    label: a.label,
    full_name: a.recipientName,
    phone: a.phone,
    address_line1: a.addressLine1,
    address_line2: a.addressLine2 || null,
    city: a.city,
    district: a.district,
    postal_code: a.postalCode,
  }
}

export function CheckoutProvider({ children }: { children: ReactNode }) {
  // §8.3: no render-time client — acquired inside async work only.
  const { userId, user, hydrated: authHydrated } = useAuth()
  // Contact details and the chosen address are read straight out of
  // localStorage during the first client render. Nothing in this provider
  // paints before `hydrated` flips, so reading here cannot desync the server
  // markup — and it avoids a second render pass on every mount.
  const [contact, setContactState] = useState<ContactInfo>(readStoredContact)
  const [addresses, setAddresses] = useState<SavedAddress[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    readStoredSelectedAddress,
  )
  const [hydrated, setHydrated] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const contactSeeded = useRef(false)

  useEffect(() => {
    localStorage.setItem(CONTACT_KEY, JSON.stringify(contact))
  }, [contact])

  useEffect(() => {
    if (selectedAddressId) localStorage.setItem(SELECTED_KEY, selectedAddressId)
  }, [selectedAddressId])

  // Load addresses (DB for authed, localStorage for guest) + merge on login
  useEffect(() => {
    if (!authHydrated) return
    let cancelled = false
    ;(async () => {
      const supabase = await getSupabaseBrowserClient()
      if (userId) {
        // merge guest addresses into DB
        let guest: SavedAddress[] = []
        try {
          const raw = localStorage.getItem(GUEST_ADDR_KEY)
          if (raw) guest = JSON.parse(raw)
        } catch {
          guest = []
        }
        for (const g of guest) {
          await supabase.from("addresses").insert({ ...toDbRow(g, userId), is_default: g.isDefault ?? false })
        }
        if (guest.length) localStorage.removeItem(GUEST_ADDR_KEY)
        // Scoped to the signed-in user explicitly rather than leaning on RLS to
        // do it. Administrators can now SELECT every address for the customer
        // screens, so "whatever the policy returns" is no longer the same thing
        // as "this account's addresses".
        const { data, error: readError } = await supabase
          .from("addresses")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
        const mapped = (data ?? []).map(mapAddrRow)
        if (!cancelled) setLoadError(!!readError)
        if (!cancelled && !readError) {
          setAddresses(mapped)
          const def = mapped.find((a) => a.isDefault)?.id ?? mapped[0]?.id ?? null
          setSelectedAddressId((prev) => prev ?? def)
        }
      } else {
        let guest: SavedAddress[] = []
        try {
          const raw = localStorage.getItem(GUEST_ADDR_KEY)
          if (raw) guest = JSON.parse(raw)
        } catch {
          guest = []
        }
        if (!cancelled) {
          setAddresses(guest)
          setSelectedAddressId((prev) => prev ?? guest[0]?.id ?? null)
        }
      }
      // Seed the checkout contact fields from the signed-in profile once, and
      // only where the visitor has not typed something of their own.
      if (!cancelled && userId && user && !contactSeeded.current) {
        contactSeeded.current = true
        setContactState((prev) =>
          prev.fullName
            ? prev
            : {
                fullName: user.name,
                email: user.email,
                phone: user.phone || prev.phone,
              },
        )
      }
      if (!cancelled) setHydrated(true)
    })()
    return () => {
      cancelled = true
    }
  }, [userId, user, authHydrated])

  const setContact = useCallback((patch: Partial<ContactInfo>) => {
    setContactState((prev) => ({ ...prev, ...patch }))
  }, [])

  const selectAddress = useCallback((id: string) => setSelectedAddressId(id), [])

  const addAddress = useCallback(
    async (address: Omit<SavedAddress, "id">) => {
      if (userId) {
        const supabase = await getSupabaseBrowserClient()
        const { data, error } = await supabase.from("addresses").insert({ ...toDbRow(address, userId), is_default: false }).select("*").maybeSingle()
        if (error || !data) return false
        const mapped = mapAddrRow(data)
        setAddresses((prev) => [...prev, mapped])
        setSelectedAddressId(mapped.id)
      } else {
        const id = `addr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
        setAddresses((prev) => [...prev, { ...address, id }])
        setSelectedAddressId(id)
      }
      return true
    },
    [userId],
  )

  const updateAddress = useCallback(
    async (id: string, patch: Omit<SavedAddress, "id">) => {
      if (userId) {
        // S26: scope to the row AND its owner — RLS is the second boundary,
        // not the only one.
        const supabase = await getSupabaseBrowserClient()
        const { error } = await supabase.from("addresses").update(toDbRow(patch, userId)).eq("id", id).eq("user_id", userId)
        if (error) return false
      }
      setAddresses((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch, id } : a)))
      return true
    },
    [userId],
  )

  const removeAddress = useCallback(
    async (id: string) => {
      if (userId) {
        const supabase = await getSupabaseBrowserClient()
        const { error } = await supabase.from("addresses").delete().eq("id", id).eq("user_id", userId)
        if (error) return false
      }
      setAddresses((prev) => {
        const next = prev.filter((a) => a.id !== id)
        return next
      })
      setSelectedAddressId((prev) => (prev === id ? null : prev))
      return true
    },
    [userId],
  )

  const setDefaultAddress = useCallback(
    async (id: string) => {
      if (userId) {
        // S26: the default-clear is owner-scoped — without user_id it would
        // touch every row except this id.
        const supabase = await getSupabaseBrowserClient()
        // Two writes (no RPC for this yet): a failure between them leaves no
        // default at all, never two — the safer half-state.
        const cleared = await supabase.from("addresses").update({ is_default: false }).neq("id", id).eq("user_id", userId)
        if (cleared.error) return false
        const set = await supabase.from("addresses").update({ is_default: true }).eq("id", id).eq("user_id", userId)
        if (set.error) {
          setAddresses((prev) => prev.map((a) => ({ ...a, isDefault: false })))
          return false
        }
      }
      setAddresses((prev) => prev.map((a) => ({ ...a, isDefault: a.id === id })))
      return true
    },
    [userId],
  )

  // persist guest addresses
  useEffect(() => {
    if (hydrated && !userId) localStorage.setItem(GUEST_ADDR_KEY, JSON.stringify(addresses))
  }, [addresses, hydrated, userId])

  const getSelectedAddress = useCallback(
    () => addresses.find((a) => a.id === selectedAddressId) ?? null,
    [addresses, selectedAddressId],
  )

  const defaultAddressId = useMemo(
    () => addresses.find((a) => a.isDefault)?.id ?? null,
    [addresses],
  )

  const value: CheckoutContextValue = useMemo(
    () => ({
      fullName: contact.fullName,
      email: contact.email,
      phone: contact.phone,
      setContact,
      addresses,
      selectedAddressId,
      defaultAddressId,
      selectAddress,
      addAddress,
      updateAddress,
      removeAddress,
      setDefaultAddress,
      getSelectedAddress,
      hydrated,
      loadError,
    }),
    [contact, setContact, addresses, selectedAddressId, defaultAddressId, selectAddress, addAddress, updateAddress, removeAddress, setDefaultAddress, getSelectedAddress, hydrated, loadError],
  )

  return <CheckoutContext.Provider value={value}>{children}</CheckoutContext.Provider>
}

export function useCheckout() {
  const ctx = useContext(CheckoutContext)
  if (!ctx) throw new Error("useCheckout must be used within a CheckoutProvider")
  return ctx
}
