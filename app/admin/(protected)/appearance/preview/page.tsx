import type { Metadata } from "next"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { adminPageContext } from "@/lib/admin/auth"
import { getThemeSettingsRow } from "@/lib/theme-settings"
import { fetchFeaturedProducts } from "@/lib/catalog"
import { resolveTheme, varsToCss } from "@/lib/theme-engine/resolve"
import { verifyAppearancePreviewToken } from "@/lib/theme-engine/preview-cookie"
import { SiteHeader } from "@/components/layout/site-header"
import { SiteFooter } from "@/components/layout/site-footer"
import { ProductEntry } from "@/components/shop/product-entry"
import { ButtonLink } from "@/components/ui/button"
import { AppearancePreviewShell } from "@/components/theme/appearance-preview-shell"
import { leavePreviewAction } from "../actions"

export const metadata: Metadata = {
  title: "Tema Önizleme",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"
export const revalidate = 0

const PREVIEW_COOKIE = "kabia_appearance_preview"

/**
 * Protected full-site preview of the draft theme.
 *
 * Three independent gates must all pass before the draft is read:
 *   1. a valid Supabase session,
 *   2. a current admin/super_admin role (re-read from `user_roles` via
 *      `adminContext("manageTheme")` — a revoked administrator loses access on
 *      the very next request),
 *   3. a valid short-lived `kabia_appearance_preview` cookie scoped to this
 *      path.
 *
 * If any gate fails, redirect to the appearance editor (or the admin login).
 * The draft CSS variables are stamped onto a wrapping `<div>` via an SSR
 * `<style>` so the real public components below render exactly as they would
 * after publish — without mutating the published theme or exposing a public
 * draft URL. The cookie is cleared by the "leave preview" form action.
 */
export default async function PreviewPage() {
  // Gate 1 + 2: session + role, via the shared page guard, which redirects to
  // the right place for each verdict. It replaced a blanket
  // `try { … } catch { redirect("/admin/login") }`, which sent an
  // administrator to the login screen whenever Supabase merely failed to
  // answer — a failed lookup treated as a signed-out session.
  const { session, supabase } = await adminPageContext("manageTheme")

  // Gate 3: signature, subject and expiry are verified. Presence alone never
  // grants preview access, and a token issued to a different administrator is
  // invalid even while that other session remains active.
  const store = await cookies()
  const previewCookie = store.get(PREVIEW_COOKIE)
  if (
    !verifyAppearancePreviewToken(previewCookie?.value, {
      userId: session.userId,
    })
  ) {
    redirect("/admin/appearance")
  }

  const row = await getThemeSettingsRow(supabase)
  if (!row) redirect("/admin/appearance")

  // The draft is the source of truth for the preview; fall back to the
  // published config when no draft exists.
  const draft = row.draftConfig ?? row.publishedConfig
  const { vars } = resolveTheme(draft)
  const previewCss = varsToCss(vars, ".theme-preview-scope")

  // Real public product data, fetched through the admin session so the
  // preview reflects live catalogue content.
  const products = await fetchFeaturedProducts(supabase).catch(() => [])

  return (
    <div className="theme-preview-scope min-h-dvh bg-ivory">
      <style
        // The preview scope overrides the document theme vars for this subtree
        // only; the admin shell outside this route is unaffected.
        dangerouslySetInnerHTML={{ __html: previewCss }}
      />

      {/* Preview banner — stays outside the storefront provider shell so its
          form action works without auth/cart contexts. */}
      <div
        role="status"
        className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 bg-shell/15 px-4 py-3 text-sm text-ink"
      >
        <span className="font-medium">
          Önizleme modu — kaydedilmemiş taslak. Bu görünüm yalnızca yöneticilere açık; mağaza ziyaretçileri değişiklikleri yayınladıktan sonra görür.
        </span>
        <form action={leavePreviewAction}>
          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink/20 px-4 text-sm text-ink transition-colors duration-200 hover:border-brand hover:text-brand"
          >
            ← Önizlemeyi kapat
          </button>
        </form>
      </div>

      {/*
        Scoped storefront provider shell: the root Providers component mounts
        only MotionConfig + ThemeProvider on /admin routes, so the transition
        from /admin/appearance to here does not remount the shared provider tree.
        The real storefront components below (SiteHeader, ProductEntry,
        SiteFooter) need the auth/cart contexts, which are provided here —
        scoped to this page's content, not the whole application.
      */}
      <AppearancePreviewShell>
        <SiteHeader />

        {/* Composed real public surfaces using the draft variables. */}
        <main className="page-top">
          <section className="wrap py-16 md:py-24">
            <p className="label text-olive">Önizleme</p>
            <h1 className="mt-3 max-w-3xl text-4xl leading-[1.08] tracking-tight md:text-6xl">
              Bademden <em className="font-theme-display italic text-brand">sofraya</em>.
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-ink/70">
              Bu önizleme, taslak tema değişkenleriyle gerçek mağaza bileşenlerini kullanır. Yayınla işlemi yapılmadan mağaza değişmez.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/magaza" size="md" prefetch={false}>
                Mağazaya git
              </ButtonLink>
              <ButtonLink href="/" variant="outline" size="md" prefetch={false}>
                Anasayfa
              </ButtonLink>
            </div>
          </section>

          <section className="wrap py-10 md:py-16">
            <h2 className="font-theme-display text-3xl italic tracking-tight md:text-4xl">
              Öne çıkan ürünler
            </h2>
            <ul className="mt-8 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {products.slice(0, 6).map((p, i) => (
                <ProductEntry key={p.id} product={p} priority={i < 3} />
              ))}
            </ul>
            {products.length === 0 && (
              <p className="mt-8 font-theme-display text-2xl italic text-ink/70">
                Öne çıkan ürün bulunamadı.
              </p>
            )}
          </section>
        </main>

        <SiteFooter />
      </AppearancePreviewShell>
    </div>
  )
}
