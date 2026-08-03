import { PreviewCanvas } from "./preview-canvas"
import type { ThemeConfiguration } from "@/lib/theme-engine/types"

/**
 * The editor's live preview panel. Wraps `PreviewCanvas` (which scopes theme
 * variables to its own subtree) in the admin Panel chrome. Unsaved edits
 * re-render this immediately; nothing is written to Supabase until the operator
 * saves.
 */
export function AppearancePreview({ config }: { config: ThemeConfiguration }) {
  return (
    <section className="rounded-[4px] border border-ink/10 bg-paper/50">
      <div className="border-b border-ink/10 px-4 py-3">
        <h2 className="label text-olive">Canlı önizleme</h2>
        <p className="mt-1 text-xs text-ink/50">
          Değişiklikler anında burada görünür; kaydedip yayınlana kadar mağazaya yansımaz.
        </p>
      </div>
      <div className="p-4 md:p-5">
        <PreviewCanvas config={config} />
      </div>
    </section>
  )
}