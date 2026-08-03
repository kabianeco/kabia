import { resolveTheme } from "@/lib/theme-engine/resolve"
import type { ThemeConfiguration } from "@/lib/theme-engine/types"

/**
 * The scoped live preview canvas. Resolves the working (unsaved) config into
 * the semantic CSS variables and stamps them onto a containing `<div>` via
 * inline style, so the variables cascade to the representative components
 * below — without leaking to the rest of the admin shell. Unsaved edits update
 * the preview immediately and never reach Supabase.
 *
 * The components here are *representative* of the public surface (button,
 * product image, product card, input, badge, dialog, navigation item, icon,
 * major heading, body paragraph, editorial quote, product title + metadata).
 * They use the same `rounded-theme-*` / `font-theme-*` utilities the real
 * public components opt into, so the preview is faithful to what publish will
 * produce.
 */
export function PreviewCanvas({ config }: { config: ThemeConfiguration }) {
  const { vars } = resolveTheme(config)

  return (
    <div
      data-theme-scope="appearance"
      style={vars as React.CSSProperties}
    >
      <div className="space-y-6 rounded-[4px] border border-ink/10 bg-ivory p-5">
        {/* Heading + body + editorial quote */}
        <div>
          <p className="label text-olive">Bölüm</p>
          <h3 className="mt-2 font-theme-display text-3xl leading-tight tracking-tight text-ink">
            Badem hasadı sonbaharda
          </h3>
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink/75">
            Geyve&apos;de kimyasal gübre kullanmadan yetiştirilen bademler bahçemizde kurutulur. Ç, ğ, ı, İ, ö, ş, ü.supported.
          </p>
          <blockquote className="mt-4 font-theme-display text-lg italic text-ink/70 ltr:text-left rtl:text-right">
            “Toprağı dinleyerek yetiştiririz.”
          </blockquote>
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-theme-button bg-brand px-5 py-2 text-sm font-medium text-on-brand">
            Birincil buton
          </span>
          <span
            className="rounded-theme-button border border-ink/20 px-5 py-2 text-sm text-ink"
            style={{ borderColor: "var(--theme-border-color)" }}
          >
            İkincil buton
          </span>
          <span className="text-sm text-brand">Metin bağı →</span>
        </div>

        {/* Input + select + badge */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <span className="label mb-1.5 block text-olive">Alan</span>
            <div
              className="rounded-theme-input bg-transparent px-0 py-3 text-base text-ink"
              style={{
                minHeight: "var(--theme-control-height-md)",
                borderBottom: "1px solid var(--theme-border-color)",
              }}
            >
              <span className="text-ink/35">Adınız</span>
            </div>
          </div>
          <div className="flex items-end gap-3">
            <span className="rounded-theme-badge bg-brand/10 px-2 py-1 text-xs text-brand">Yeni</span>
            <span className="rounded-theme-badge border border-ink/20 px-2 py-1 text-xs text-ink/70" style={{ borderColor: "var(--theme-border-color)" }}>Çekirdek</span>
          </div>
        </div>

        {/* Product image + product card */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="overflow-hidden rounded-theme-product-image bg-shell/25" style={{ aspectRatio: "4 / 5" }}>
            <div className="flex h-full items-center justify-center">
              <span className="label text-olive">Görsel</span>
            </div>
          </div>
          <div className="overflow-hidden rounded-theme-card border bg-paper/60 p-4" style={{ borderColor: "var(--theme-border-color)", boxShadow: "var(--theme-shadow-card)" }}>
            <p className="label text-olive">Kategori</p>
            <h4 className="mt-1 text-lg leading-snug text-ink">Çiğ badem 500g</h4>
            <p className="figure mt-2 text-base text-ink">₺285,00</p>
            <div className="mt-3 flex items-center gap-2">
              <span className="rounded-theme-badge bg-brand/10 px-2 py-0.5 text-xs text-brand">Stokta</span>
              <span className="text-xs text-ink/45">Geyve</span>
            </div>
          </div>
        </div>

        {/* Navigation item + dialog sample + icon */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-theme-navigation bg-ink/[0.04] px-3 py-1.5 text-sm text-ink">
            Navigasyon
          </span>
          <span
            className="rounded-theme-dialog border bg-ivory px-4 py-2 text-sm text-ink shadow-theme-dialog"
            style={{ borderColor: "var(--theme-border-color)" }}
          >
            Diyalog örneği
          </span>
          <span
            className="flex items-center justify-center text-ink/60"
            style={{
              borderRadius: "var(--theme-radius-icon-container)",
              border: "1px solid var(--theme-border-color)",
              borderWidth: "var(--theme-border-width)",
              width: "var(--theme-icon-size-md)",
              height: "var(--theme-icon-size-md)",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={Number(vars["--theme-icon-stroke-width"])}>
              <path d="M12 2v6M12 16v6M2 12h6M16 12h6" strokeLinecap="round" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  )
}