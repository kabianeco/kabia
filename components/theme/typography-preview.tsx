import { APPROVED_BODY_FONTS, APPROVED_DISPLAY_FONTS } from "@/lib/theme-engine/fonts"
import { TYPOGRAPHY_PROFILES } from "@/lib/theme-engine/profiles"
import type { BodyFontId, DisplayFontId, TypographyProfileId } from "@/lib/theme-engine/types"

/**
 * Typography controls + a dedicated preview area.
 *
 * Selecting a typography profile sets both font roles; the body and display
 * selects may then be adjusted independently. When the chosen combination no
 * longer matches the selected profile, an informational warning is shown but
 * the combination is still allowed (both fonts are approved).
 *
 * The preview renders sample Turkish text covering ç, ğ, ı, İ, ö, ş, ü so the
 * operator can verify glyph coverage for every approved font. Font names are
 * rendered in their own typeface where practical.
 */
export function TypographyPreview({
  profile,
  bodyFont,
  displayFont,
  onProfileChange,
  onBodyFontChange,
  onDisplayFontChange,
}: {
  profile: TypographyProfileId
  bodyFont: BodyFontId
  displayFont: DisplayFontId
  onProfileChange: (id: TypographyProfileId) => void
  onBodyFontChange: (id: BodyFontId) => void
  onDisplayFontChange: (id: DisplayFontId) => void
}) {
  const currentProfile = TYPOGRAPHY_PROFILES[profile]
  const matches =
    currentProfile.fonts.body === bodyFont && currentProfile.fonts.display === displayFont

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <label className="flex flex-col">
          <span className="label mb-1.5 text-olive">Tipografi profili</span>
          <select
            value={profile}
            onChange={(e) => onProfileChange(e.target.value as TypographyProfileId)}
            className="min-h-11 rounded-[3px] border border-ink/15 bg-ivory px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/40"
          >
            {Object.values(TYPOGRAPHY_PROFILES).map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <span className="mt-1 text-xs leading-relaxed text-ink/45">{currentProfile.character}</span>
        </label>

        <label className="flex flex-col">
          <span className="label mb-1.5 text-olive">Gövde ve arayüz fontu</span>
          <select
            value={bodyFont}
            onChange={(e) => onBodyFontChange(e.target.value as BodyFontId)}
            className="min-h-11 rounded-[3px] border border-ink/15 bg-ivory px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/40"
          >
            {APPROVED_BODY_FONTS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col">
          <span className="label mb-1.5 text-olive">Editoryal ve başlık fontu</span>
          <select
            value={displayFont}
            onChange={(e) => onDisplayFontChange(e.target.value as DisplayFontId)}
            className="min-h-11 rounded-[3px] border border-ink/15 bg-ivory px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/40"
          >
            {APPROVED_DISPLAY_FONTS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!matches && (
        <p role="status" className="rounded-[3px] border border-shell/40 bg-shell/10 px-3 py-2 text-xs text-ink/80">
          Seçili font kombinasyonu “{currentProfile.label}” profilinden farklı. Her iki font onaylı olduğu için izin verilir.
        </p>
      )}

      <div className="rounded-[4px] border border-ink/10 bg-paper/40 p-5">
        <p className="label text-olive">Önizleme</p>
        <dl className="mt-3 space-y-4">
          <div>
            <dt className="text-xs text-ink/45">Başlık (display)</dt>
            <dd className="mt-1 text-3xl leading-tight tracking-tight" style={{ fontFamily: "var(--preview-font-display, var(--font-display)), Georgia, serif" }}>
              Badem hasatı sonbaharda
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink/45">Editoryal alıntı</dt>
            <dd className="mt-1 text-xl italic" style={{ fontFamily: "var(--preview-font-display, var(--font-display)), Georgia, serif" }}>
              “Toprağı dinleyerek yetiştiririz.”
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink/45">Bölüm başlığı (serif, sabit)</dt>
            <dd className="mt-1 font-serif text-lg text-ink">Çiftlik yaklaşımı</dd>
          </div>
          <div>
            <dt className="text-xs text-ink/45">Gövde metni (body)</dt>
            <dd className="mt-1 max-w-prose text-sm leading-relaxed text-ink/80" style={{ fontFamily: "var(--preview-font-body, var(--font-body)), system-ui, sans-serif" }}>
              Geyve&apos;de, kimyasal gübre ve ilaç kullanmadan yetiştirilen bademler çiğdemişten sonra bahçemizde kurutulur. Ç, ğ, ı, İ, ö, ş, ü harfleri desteklenir.
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink/45">Navigasyon / buton (body)</dt>
            <dd className="mt-1 text-sm font-medium text-brand" style={{ fontFamily: "var(--preview-font-body, var(--font-body)), system-ui, sans-serif" }}>
              Mağazaya git →
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink/45">Türkçe karakter desteği</dt>
            <dd className="mt-1 text-base" style={{ fontFamily: "var(--preview-font-display, var(--font-display)), Georgia, serif" }}>
              Çiğdem, ğöğüs, ırak, İzmir, ömür, şömine, üfürük
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}