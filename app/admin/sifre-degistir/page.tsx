import type { Metadata } from "next"
import Image from "next/image"
import { redirect } from "next/navigation"
import { getAdminSession } from "@/lib/admin/auth"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { InlineAlert } from "@/components/admin/ui/surfaces"
import { adminSignOutAction } from "../login/actions"
import { AdminPasswordForm } from "./password-form"

export const metadata: Metadata = {
  title: "Parola Değiştir",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

/**
 * Deliberately outside the (protected) group.
 *
 * The protected layout sends anyone with `must_change_password` here, so this
 * screen cannot live under that layout without a redirect loop. It carries its
 * own guard instead — same checks, no shell, and no way to reach the rest of
 * the dashboard until the password has actually been changed.
 */
export default async function AdminPasswordChangePage() {
  const session = await getAdminSession()

  if (!session) {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    redirect(user ? "/admin/unauthorized" : "/admin/login")
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Image
            src="/images/logo.svg"
            alt="Kabia Ekolojik"
            width={177}
            height={60}
            priority
            className="mx-auto h-8 w-auto"
          />
          <p className="label mt-5 text-olive">Yönetim paneli</p>
          <h1 className="mt-3 font-serif text-2xl leading-tight text-ink">
            {session.mustChangePassword ? "Parolanızı belirleyin" : "Parolanızı değiştirin"}
          </h1>
        </div>

        {session.mustChangePassword && (
          <div className="mb-6">
            <InlineAlert tone="warning">
              Bu hesap kurulum parolasıyla oluşturuldu. Panele devam etmeden önce kendi
              parolanızı belirlemeniz gerekiyor.
            </InlineAlert>
          </div>
        )}

        <div className="rounded-[5px] border border-ink/10 bg-paper/50 p-6">
          <AdminPasswordForm />
        </div>

        <div className="mt-6 text-center">
          <form action={adminSignOutAction}>
            <button
              type="submit"
              className="min-h-11 text-xs text-ink/45 transition-colors duration-300 hover:text-ink"
            >
              Farklı bir hesapla giriş yap
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
