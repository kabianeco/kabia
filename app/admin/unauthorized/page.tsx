import type { Metadata } from "next"
import Link from "next/link"
import { adminSignOutAction } from "../login/actions"

export const metadata: Metadata = {
  title: "Yetkisiz Erişim",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

/**
 * Where a signed-in user without an administrative role lands.
 *
 * It says only that this account lacks access — never whether the dashboard
 * exists for someone else, which roles there are, or who holds them.
 */
export default function AdminUnauthorizedPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-16">
      <div className="w-full max-w-md text-center">
        <p className="label text-olive">Erişim reddedildi</p>
        <h1 className="mt-4 font-serif text-3xl leading-tight text-ink">
          Bu sayfayı görüntüleme yetkiniz yok
        </h1>
        <p className="mt-5 text-sm leading-relaxed text-ink/60">
          Hesabınız yönetim paneline erişim için yetkilendirilmemiş. Yetkiniz olması
          gerektiğini düşünüyorsanız bir süper yönetici ile iletişime geçin.
        </p>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            prefetch={false}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand px-6 text-sm font-medium text-on-brand transition-colors duration-300 hover:bg-forest"
          >
            Mağazaya dön
          </Link>
          <form action={adminSignOutAction}>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink/20 px-6 text-sm text-ink transition-colors duration-300 hover:border-brand hover:text-brand"
            >
              Oturumu kapat
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
