"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import type { User } from "@supabase/supabase-js"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

export interface AuthUser {
  name: string
  email: string
  phone: string
  memberSince: string // ISO date
  birthDate?: string
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
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Shape of a row in the `profiles` table (only the columns this app reads). */
export interface ProfileRow {
  id: string
  full_name: string | null
  phone: string | null
  birth_date: string | null
  created_at: string | null
}

function toAuthUser(supabaseUser: User | null, profile: ProfileRow | null): AuthUser | null {
  if (!supabaseUser) return null
  return {
    name: profile?.full_name ?? (supabaseUser.email?.split("@")[0] ?? ""),
    email: supabaseUser.email ?? "",
    phone: profile?.phone ?? "",
    memberSince: profile?.created_at ?? supabaseUser.created_at ?? new Date().toISOString(),
    birthDate: profile?.birth_date ?? undefined,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = createSupabaseBrowserClient()
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

  // Bootstrap session + subscribe to auth state changes
  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSupabaseUser(data.session?.user ?? null)
      setHydrated(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSupabaseUser(session?.user ?? null)
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [supabase])

  // Load the profile row whenever the auth user changes.
  useEffect(() => {
    const userId = supabaseUser?.id
    if (!userId) return
    let active = true
    supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setLoadedProfile({ userId, row: data as ProfileRow | null })
      })
    return () => {
      active = false
    }
  }, [supabaseUser, supabase])

  const user = useMemo(() => toAuthUser(supabaseUser, profile), [supabaseUser, profile])

  const login = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return { error: error.message }
      setSupabaseUser(data.user)
      return {}
    },
    [supabase],
  )

  const register = useCallback(
    async (data: { name: string; email: string; phone: string; password: string }): Promise<AuthResult> => {
      const { data: res, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: { data: { full_name: data.name, phone: data.phone } },
      })
      if (error) return { error: error.message }
      setSupabaseUser(res.user)
      // If email confirmation is enabled, no session is returned yet.
      if (!res.session) return { needsEmailConfirm: true }
      return {}
    },
    [supabase],
  )

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setSupabaseUser(null)
    setLoadedProfile(null)
  }, [supabase])

  const updateProfile = useCallback(
    async (patch: Partial<AuthUser>): Promise<AuthResult> => {
      if (!supabaseUser) return { error: "Not authenticated" }
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
    [supabase, supabaseUser],
  )

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
    }),
    [supabaseUser, user, hydrated, login, register, logout, updateProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider")
  return ctx
}
