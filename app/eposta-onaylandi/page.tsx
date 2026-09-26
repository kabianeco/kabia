import type { Metadata } from "next"
import { AuthFlowPage } from "@/components/auth/auth-flow-page"
import { TimedRedirect } from "@/components/auth/timed-redirect"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export const metadata: Metadata = { title: "E-posta onaylandı", robots: { index: false } }

export default async function EmailConfirmedPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/baglanti-gecersiz?flow=signup")
  return <AuthFlowPage title="E-postanız doğrulandı" lead="Hesabınıza giriş yaptınız. Artık Kabia'da devam edebilirsiniz."><TimedRedirect href="/" label="Ana sayfaya git" /></AuthFlowPage>
}
