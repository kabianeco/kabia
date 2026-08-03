import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { resolveAdminAccess } from "@/lib/admin/auth"
import { adminSignOutAction } from "./actions"
import { AdminLoginForm } from "./login-form"

export const metadata: Metadata = {
  title: "Yönetim Girişi",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

/**
 * The sign-in screen, and a terminal one.
 *
 * An administrator who already has a session is offered a link into the
 * dashboard rather than being redirected there. That is not a style choice.
 * This page is where the protected layout sends anyone it could not admit, so a
 * redirect from here back into the protected area closes a cycle: layout says
 * "no session, go to login", login says "session, go to the dashboard", and a
 * browser handed both answers in turn navigates between them forever. Rendering
 * a link instead makes every automatic edge in the admin redirect graph point
 * outward, so the graph cannot be walked in a circle. Entering the dashboard is
 * something a person does — by submitting this form, or by following the link
 * below — never something a failed lookup can do on their behalf.
 */
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const access = await resolveAdminAccess()
  const { next } = await searchParams

  const signedIn = access.status === "admin" ? access.session : null

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
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
            {signedIn ? "Zaten giriş yaptınız" : "Hesabınıza giriş yapın"}
          </h1>
        </div>

        {signedIn ? (
          <div className="rounded-[5px] border border-ink/10 bg-paper/50 p-6 text-center">
            <p className="text-sm leading-relaxed text-ink/70">
              <span className="text-ink">{signedIn.displayName}</span> olarak oturumunuz
              açık.
            </p>
            <Link
              href={signedIn.mustChangePassword ? "/admin/sifre-degistir" : "/admin"}
              prefetch={false}
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-brand px-6 text-sm font-medium text-on-brand transition-colors duration-300 hover:bg-forest"
            >
              {signedIn.mustChangePassword ? "Parolanızı belirleyin" : "Panele git"}
            </Link>
            <form action={adminSignOutAction} className="mt-4">
              <button
                type="submit"
                className="min-h-11 text-xs text-ink/45 transition-colors duration-300 hover:text-ink"
              >
                Farklı bir hesapla giriş yap
              </button>
            </form>
          </div>
        ) : (
          <div className="rounded-[5px] border border-ink/10 bg-paper/50 p-6">
            <AdminLoginForm next={next} />
          </div>
        )}

        <p className="mt-8 text-center text-xs leading-relaxed text-ink/45">
          Bu alan yalnızca yetkili yöneticiler içindir. Müşteri hesabınıza giriş yapmak için{" "}
          <Link href="/giris" prefetch={false} className="text-brand transition-colors duration-300 hover:text-forest">
            mağaza girişini
          </Link>{" "}
          kullanın.
        </p>
      </div>
    </main>
  )
}
