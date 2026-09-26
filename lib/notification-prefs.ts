"use client"

import { useCallback, useEffect, useState } from "react"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth-context"
import type { NotificationPreferencesRow } from "@/lib/supabase/rows"

export interface NotificationPrefs {
  campaignEmails: boolean
  orderStatus: boolean
  sms: boolean
  stockAlerts: boolean
}

const STORAGE_KEY = "kabia_notification_prefs"

const DEFAULT_PREFS: NotificationPrefs = {
  campaignEmails: true,
  orderStatus: true,
  sms: false,
  stockAlerts: true,
}

function mapRow(r: NotificationPreferencesRow): NotificationPrefs {
  return {
    campaignEmails: r.campaign_emails ?? true,
    orderStatus: r.order_status ?? true,
    sms: r.sms ?? false,
    stockAlerts: r.stock_alerts ?? true,
  }
}

export function useNotificationPrefs() {
  // §8.3: no render-time client — acquired inside async work only.
  const { userId, hydrated: authHydrated } = useAuth()
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (!authHydrated) return
    let cancelled = false
    ;(async () => {
      const supabase = await getSupabaseBrowserClient()
      if (userId) {
        const { data } = await supabase.from("notification_preferences").select("*").eq("user_id", userId).maybeSingle()
        if (!cancelled) setPrefs(data ? mapRow(data) : DEFAULT_PREFS)
      } else {
        try {
          const raw = localStorage.getItem(STORAGE_KEY)
          if (!cancelled) setPrefs(raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS)
        } catch {
          if (!cancelled) setPrefs(DEFAULT_PREFS)
        }
      }
      if (!cancelled) setHydrated(true)
    })()
    return () => {
      cancelled = true
    }
  }, [userId, authHydrated])

  useEffect(() => {
    if (hydrated && !userId) localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  }, [prefs, hydrated, userId])

  const setPref = useCallback(
    (key: keyof NotificationPrefs, value: boolean) => {
      setPrefs((prev) => ({ ...prev, [key]: value }))
      if (userId) {
        const col =
          key === "campaignEmails" ? "campaign_emails"
            : key === "orderStatus" ? "order_status"
              : key === "sms" ? "sms"
                : "stock_alerts"
        getSupabaseBrowserClient().then((supabase) => {
          supabase.from("notification_preferences").update({ [col]: value }).eq("user_id", userId).then(() => {})
        })
      }
    },
    [userId],
  )

  return { prefs, setPref, hydrated }
}
