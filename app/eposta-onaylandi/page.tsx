import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Accent } from "@/components/auth/accent"
import { StatusScreen } from "@/components/auth/status-screen"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { routes } from "@/lib/site"

export const metadata: Metadata = { title: "E-posta onaylandı", robots: { index: false } }

/** Shown only with the session the verified link or code just created. */
export default async function EmailConfirmedPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/baglanti-gecersiz?flow=signup")
  return (
    <StatusScreen
      tone="success"
      eyebrow="Hesap · Doğrulandı"
      title={<>E-postanız <Accent>doğrulandı</Accent>.</>}
      lead="Hesabınız hazır."
      action={{ href: routes.account, label: "Hesabıma git" }}
    />
  )
}
