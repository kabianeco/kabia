import { cn } from "@/lib/utils"
import type { ShapePresetId } from "@/lib/theme-engine/types"
import { SHAPE_PRESETS } from "@/lib/theme-engine/presets"

/**
 * Three large preset cards — Keskin, Dengeli, Yumuşak. Each renders a compact
 * visual preview (image, product card, button, input, badge, icon, heading,
 * body) styled by that preset's tokens, so the operator sees the shape before
 * selecting. Not text-only radios.
 *
 * State indicators:
 *   ✔ Yayında  — the published preset
 *   Taslak    — the draft (saved) preset
 *   Seçili    — the working (possibly unsaved) preset
 */
export function PresetCards({
  selected,
  draftPreset,
  publishedPreset,
  onSelect,
}: {
  selected: ShapePresetId
  draftPreset: ShapePresetId
  publishedPreset: ShapePresetId
  onSelect: (id: ShapePresetId) => void
}) {
  return (
    <ul className="grid gap-4 sm:grid-cols-3" role="radiogroup" aria-label="Şekil preseti">
      {(Object.values(SHAPE_PRESETS)).map((preset) => {
        const isSelected = preset.id === selected
        const isDraft = preset.id === draftPreset
        const isPublished = preset.id === publishedPreset
        return (
          <li key={preset.id}>
            <button
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(preset.id)}
              className={cn(
                "flex h-full w-full flex-col rounded-[4px] border p-0 text-left transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-brand",
                isSelected ? "border-brand ring-1 ring-brand/40 bg-paper/80" : "border-ink/15 bg-paper/40 hover:border-ink/30",
              )}
            >
              {/* Visual preview */}
              <div className="border-b border-ink/10 p-4">
                <div
                  className="mb-3 aspect-[4/3] w-full bg-shell/25"
                  style={{ borderRadius: Math.min(preset.radius.image, 16) }}
                />
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center justify-center bg-brand px-3 py-1 text-xs text-on-brand"
                    style={{ borderRadius: Math.min(preset.radius.button, 16) }}
                  >
                    Buton
                  </span>
                  <span
                    className="inline-flex items-center px-2 py-1 text-[10px] text-ink/70"
                    style={{
                      borderRadius: Math.min(preset.radius.badge, 16),
                      border: "1px solid color-mix(in srgb, var(--color-ink) 18%, transparent)",
                    }}
                  >
                    Etiket
                  </span>
                  <span
                    className="ml-auto inline-flex h-5 w-5 items-center justify-center text-ink/60"
                    style={{
                      borderRadius: Math.min(preset.radius.iconContainer, 16),
                      border: "1px solid color-mix(in srgb, var(--color-ink) 18%, transparent)",
                      borderWidth: preset.border.width,
                    }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={preset.icon.strokeWidth}>
                      <path d="M12 2v6M12 16v6M2 12h6M16 12h6" strokeLinecap="round" />
                    </svg>
                  </span>
                </div>
                <div
                  className="mt-3 flex items-center"
                  style={{
                    borderRadius: Math.min(preset.radius.input, 12),
                    border: "1px solid color-mix(in srgb, var(--color-ink) 18%, transparent)",
                    borderWidth: preset.border.width,
                    height: "28px",
                  }}
                >
                  <span className="px-2 text-[10px] text-ink/40">Alan</span>
                </div>
              </div>
              {/* Label */}
              <div className="flex items-center justify-between gap-2 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-serif text-lg leading-none text-ink">{preset.label}</p>
                  <p className="mt-1 truncate text-xs text-ink/50">{preset.character}</p>
                </div>
                <span className="flex shrink-0 items-center gap-1">
                  {isPublished && (
                    <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] text-brand">Yayında</span>
                  )}
                  {isDraft && !isPublished && (
                    <span className="rounded-full bg-shell/20 px-2 py-0.5 text-[10px] text-ink/70">Taslak</span>
                  )}
                  {isSelected && (
                    <span className="rounded-full border border-brand px-2 py-0.5 text-[10px] text-brand" aria-hidden="true">Seçili</span>
                  )}
                </span>
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}