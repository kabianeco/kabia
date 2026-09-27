"use client"

import { useCallback, useEffect, useState } from "react"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth-context"

/**
 * The signed-in customer's campaign e-mail consent, read through RLS.
 *
 * Campaign e-mail is a recorded consent (public.set_marketing_email_consent)
 * and opt-in: missing row or unknown value means "off".
 */
export function useCampaignConsent() {
  const { userId, hydrated: authHydrated } = useAuth()
  const [granted, setGranted] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!authHydrated || !userId) return
    let cancelled = false
    ;(async () => {
      const supabase = await getSupabaseBrowserClient()
      const { data, error: readError } = await supabase
        .from("notification_preferences")
        .select("campaign_emails")
        .eq("user_id", userId)
        .maybeSingle()
      if (cancelled) return
      setError(!!readError)
      setGranted(data?.campaign_emails === true)
      setHydrated(true)
    })()
    return () => {
      cancelled = true
    }
  }, [userId, authHydrated, attempt])

  const retry = useCallback(() => {
    setHydrated(false)
    setAttempt((n) => n + 1)
  }, [])

  return { granted, setGranted, hydrated, error, retry }
}

/**
 * The signed-in customer's order-status e-mail preference, read through
 * RLS. Opt-out model mirroring `orderStatusEmailsAllowed` in
 * lib/email/notify.ts: missing row or unknown value means "on" — only a
 * persisted `false` stops the shipping/delivery mails.
 */
export function useOrderStatusConsent() {
  const { userId, hydrated: authHydrated } = useAuth()
  const [granted, setGranted] = useState(true)
  const [hydrated, setHydrated] = useState(false)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!authHydrated || !userId) return
    let cancelled = false
    ;(async () => {
      const supabase = await getSupabaseBrowserClient()
      const { data, error: readError } = await supabase
        .from("notification_preferences")
        .select("order_status")
        .eq("user_id", userId)
        .maybeSingle()
      if (cancelled) return
      setError(!!readError)
      setGranted(data?.order_status !== false)
      setHydrated(true)
    })()
    return () => {
      cancelled = true
    }
  }, [userId, authHydrated, attempt])

  const retry = useCallback(() => {
    setHydrated(false)
    setAttempt((n) => n + 1)
  }, [])

  return { granted, setGranted, hydrated, error, retry }
}
