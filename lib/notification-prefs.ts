"use client"

import { useCallback, useEffect, useState } from "react"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth-context"

/**
 * The signed-in customer's campaign e-mail consent, read through RLS.
 *
 * Only campaign e-mail is a live preference: it is a recorded consent
 * (public.set_marketing_email_consent). Order-status, SMS and stock-alert
 * messages have no sending pipeline yet, so they are not offered as switches.
 * Missing row or unknown value means "off" — campaign e-mail is opt-in.
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
