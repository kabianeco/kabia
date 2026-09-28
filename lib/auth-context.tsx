"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import type { User } from "@supabase/supabase-js"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

export interface AuthUser {
  name: string
  email: string
  phone: string
  memberSince: string // ISO date
  birthDate?: string
  /** Müşteri numarası (KE-######). Profil satırı gelene kadar tanımsız. */
  customerNumber?: string
}

interface AuthResult {
  error?: string
  needsEmailConfirm?: boolean
}

interface AuthContextValue {
  isLoggedIn: boolean
  user: AuthUser | null
  userId: string | null
  hydrated: boolean
  login: (email: string, password: string) => Promise<AuthResult>
  register: (data: { name: string; email: string; phone: string; password: string }) => Promise<AuthResult>
  logout: () => Promise<void>
  updateProfile: (patch: Partial<AuthUser>) => Promise<AuthResult>
  /** Reflects a profile saved on the server (updateProfileAction) without a refetch. */
  applyProfile: (row: { full_name: string; phone: string | null; birth_date: string | null; customer_number?: string | null }) => void
  /**
   * Re-reads the browser session after a server-action sign-in.
   *
   * The customer login runs on the server (rate-limited there), so its
   * Set-Cookie lands in the browser without touching this context's
   * `supabaseUser`. Without an explicit re-read the account guard still sees
   * "logged out" and bounces the fresh sign-in back to /giris with no
   * message. The login form awaits this before navigating so the first
   * attempt lands every time.
   */
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * The key @supabase/ssr stores the session under: the cookie name (chunked as
 * `.0`, `.1` when large) and the name of supabase-js's cross-tab channel.
 */
function authStorageKey(): string {
  try {
    return `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname.split(".")[0]}-auth-token`
  } catch {
    return "sb-auth-token"
  }
}

/** True when a Supabase session cookie is present (readable: httpOnly is false). */
function hasSessionCookie(): boolean {
  try {
    const key = authStorageKey()
    return document.cookie.split(";").some((c) => {
      const name = c.trim().split("=")[0]
      return name === key || name.startsWith(`${key}.`)
    })
  } catch {
    return false
  }
}

/** Shape of a row in the `profiles` table (only the columns this app reads). */
export interface ProfileRow {
  id: string
  full_name: string | null
  phone: string | null
  birth_date: string | null
  created_at: string | null
  customer_number: string | null
}

function toAuthUser(supabaseUser: User | null, profile: ProfileRow | null): AuthUser | null {
  if (!supabaseUser) return null
  return {
    name: profile?.full_name ?? (supabaseUser.email?.split("@")[0] ?? ""),
    email: supabaseUser.email ?? "",
    phone: profile?.phone ?? "",
    memberSince: profile?.created_at ?? supabaseUser.created_at ?? new Date().toISOString(),
    birthDate: profile?.birth_date ?? undefined,
    customerNumber: profile?.customer_number ?? undefined,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // §8.3: no render-time client — the lazily loaded browser client is
  // acquired inside async work only.
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null)
  // The loaded profile is stored with the id it belongs to, so signing out or
  // switching accounts drops it by derivation instead of needing an effect to
  // clear it.
  const [loadedProfile, setLoadedProfile] = useState<{
    userId: string
    row: ProfileRow | null
  } | null>(null)
  const profile =
    loadedProfile && loadedProfile.userId === supabaseUser?.id
      ? loadedProfile.row
      : null
  const [hydrated, setHydrated] = useState(false)

  // Bootstrap session + subscribe to auth state changes.
  //
  // An anonymous visitor carries no session cookie, and getSession() would
  // answer null without a network call — so the ~65 KB browser client is not
  // loaded for them at all. The moment a session can exist, the client is
  // attached exactly as before: a sign-in from this tab (login/register/
  // refreshSession attach it), from another tab (supabase-js's own
  // BroadcastChannel), or through a server action whose cookie shows up when
  // the tab is refocused (supabase-js's own visibility re-check).
  const attachRef = useRef<() => Promise<void>>(async () => {})
  useEffect(() => {
    let mounted = true
    let sub: { subscription: { unsubscribe: () => void } } | null = null
    let attaching: Promise<void> | null = null
    const attach = () => {
      attaching ??= (async () => {
        const supabase = await getSupabaseBrowserClient()
        if (!mounted) return
        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
          if (mounted) setSupabaseUser(session?.user ?? null)
        })
        sub = data
        const { data: current } = await supabase.auth.getSession()
        if (!mounted) return
        setSupabaseUser(current.session?.user ?? null)
        setHydrated(true)
      })()
      return attaching
    }
    attachRef.current = attach

    if (hasSessionCookie()) {
      void attach()
      return () => {
        mounted = false
        sub?.subscription.unsubscribe()
      }
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- anonymous visitor: the session answer is known without the client.
    setHydrated(true)
    const recheck = () => {
      if (hasSessionCookie()) void attach()
    }
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(authStorageKey()) : null
    channel?.addEventListener("message", recheck)
    document.addEventListener("visibilitychange", recheck)
    window.addEventListener("focus", recheck)
    return () => {
      mounted = false
      channel?.close()
      document.removeEventListener("visibilitychange", recheck)
      window.removeEventListener("focus", recheck)
      sub?.subscription.unsubscribe()
    }
  }, [])

  // Load the profile row whenever the auth user changes.
  useEffect(() => {
    const userId = supabaseUser?.id
    if (!userId) return
    let active = true
    ;(async () => {
      const supabase = await getSupabaseBrowserClient()
      if (!active) return
      supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle()
        .then(({ data }) => {
          if (active) setLoadedProfile({ userId, row: data as ProfileRow | null })
        })
    })()
    return () => {
      active = false
    }
  }, [supabaseUser])

  const user = useMemo(() => toAuthUser(supabaseUser, profile), [supabaseUser, profile])

  const login = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const supabase = await getSupabaseBrowserClient()
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return { error: error.message }
      setSupabaseUser(data.user)
      void attachRef.current()
      return {}
    },
    [],
  )

  const register = useCallback(
    async (data: { name: string; email: string; phone: string; password: string }): Promise<AuthResult> => {
      const supabase = await getSupabaseBrowserClient()
      const { data: res, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: { data: { full_name: data.name, phone: data.phone } },
      })
      if (error) return { error: error.message }
      setSupabaseUser(res.user)
      void attachRef.current()
      // If email confirmation is enabled, no session is returned yet.
      if (!res.session) return { needsEmailConfirm: true }
      return {}
    },
    [],
  )

  // "Çıkış yap" ends this browser's session only. Signing out every device is
  // a separate, password-confirmed action on /hesabim/guvenlik.
  const logout = useCallback(async () => {
    const supabase = await getSupabaseBrowserClient()
    await supabase.auth.signOut({ scope: "local" })
    setSupabaseUser(null)
    setLoadedProfile(null)
  }, [])

  const updateProfile = useCallback(
    async (patch: Partial<AuthUser>): Promise<AuthResult> => {
      if (!supabaseUser) return { error: "Not authenticated" }
      const supabase = await getSupabaseBrowserClient()
      const updates: Record<string, unknown> = {}
      if (patch.name !== undefined) updates.full_name = patch.name
      if (patch.phone !== undefined) updates.phone = patch.phone
      if (patch.birthDate !== undefined) updates.birth_date = patch.birthDate || null
      const { error } = await supabase.from("profiles").update(updates).eq("id", supabaseUser.id)
      if (error) return { error: error.message }
      setLoadedProfile((prev) =>
        prev && prev.row ? { ...prev, row: { ...prev.row, ...updates } } : prev,
      )
      return {}
    },
    [supabaseUser],
  )

  const applyProfile = useCallback(
    (row: { full_name: string; phone: string | null; birth_date: string | null; customer_number?: string | null }) => {
      setLoadedProfile((prev) => (prev && prev.row ? { ...prev, row: { ...prev.row, ...row } } : prev))
    },
    [],
  )

  const refreshSession = useCallback(async () => {
    const supabase = await getSupabaseBrowserClient()
    try {
      const { data } = await supabase.auth.getSession()
      setSupabaseUser(data.session?.user ?? null)
      if (data.session) void attachRef.current()
    } catch {
      // A failed re-read leaves the previous state: the server layout is the
      // authority on the next navigation, never a thrown client error.
    }
  }, [])

  const value: AuthContextValue = useMemo(
    () => ({
      isLoggedIn: !!supabaseUser,
      user,
      userId: supabaseUser?.id ?? null,
      hydrated,
      login,
      register,
      logout,
      updateProfile,
      applyProfile,
      refreshSession,
    }),
    [supabaseUser, user, hydrated, login, register, logout, updateProfile, applyProfile, refreshSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider")
  return ctx
}
