import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { redirect } from "next/navigation"
import { getAdminSession } from "@/lib/admin/auth"
import { AdminLoginForm } from "./login-form"

export const metadata: Metadata = {
  title: "Yönetim Girişi",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  // An administrator who already has a session has no business here.
  const session = await getAdminSession()
  if (session) redirect(session.mustChangePassword ? "/admin/sifre-degistir" : "/admin")

  const { next } = await searchParams

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
            Hesabınıza giriş yapın
          </h1>
        </div>

        <div className="rounded-[5px] border border-ink/10 bg-paper/50 p-6">
          <AdminLoginForm next={next} />
        </div>

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
