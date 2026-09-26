import type { Metadata } from "next"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { AuthFlowPage } from "@/components/auth/auth-flow-page"
import { NewPasswordForm } from "@/components/auth/new-password-form"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { RECOVERY_COOKIE, verifyRecoveryGrant } from "@/lib/auth/recovery-grant"

export const metadata: Metadata = { title: "Şifre yenile", robots: { index: false } }

export default async function NewPasswordPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  const cookieStore = await cookies()
  if (error || !user || !verifyRecoveryGrant(cookieStore.get(RECOVERY_COOKIE)?.value, user.id)) {
    redirect("/sifremi-unuttum?reason=session")
  }
  return <AuthFlowPage title="Yeni şifrenizi belirleyin" lead="Hesabınız için yeni bir şifre girin."><NewPasswordForm /></AuthFlowPage>
}
