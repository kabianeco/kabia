import { ConfirmAction } from "@/components/admin/ui/confirm-dialog"
import type { ThemeRevisionRow } from "@/lib/theme-settings"
import { restoreRevisionFormAction } from "@/app/admin/(protected)/appearance/actions"
import { labelForBodyFont, labelForDisplayFont } from "@/lib/theme-engine/fonts"
import { getPreset } from "@/lib/theme-engine/presets"

/**
 * Append-only revision history for the appearance editor. Each row is a
 * published version; restoring one copies its config forward as a NEW version
 * via the trusted `restore_site_theme_version` RPC (history is never mutated).
 *
 * The list itself is read-only; restore happens through a confirmation dialog
 * that names the version being restored.
 */
export function RevisionHistory({
  rows,
  currentVersion,
  emptyText = "Henüz yayınlanmış sürüm yok.",
}: {
  rows: ThemeRevisionRow[]
  currentVersion: number
  emptyText?: string
}) {
  if (rows.length === 0) {
    return <p className="rounded-[3px] border border-ink/10 bg-paper/40 px-4 py-6 text-center text-sm text-ink/50">{emptyText}</p>
  }

  return (
    <ul className="space-y-2">
      {rows.map((row) => {
        const isCurrent = row.version === currentVersion
        const preset = getPreset(row.config.shapePreset)
        return (
          <li
            key={row.version}
            className="flex flex-col gap-3 rounded-[4px] border border-ink/10 bg-paper/40 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="figure text-base text-ink">Sürüm {row.version}</span>
                {isCurrent ? (
                  <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] text-brand">Yayında</span>
                ) : (
                  <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 text-[10px] text-ink/55">önceki</span>
                )}
                <span className="text-xs text-ink/45">· {row.action}</span>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-ink/60 sm:grid-cols-4">
                <div>
                  <dt className="inline text-ink/40">Preset: </dt>
                  <dd className="inline text-ink/75">{preset.label}</dd>
                </div>
                <div>
                  <dt className="inline text-ink/40">Profil: </dt>
                  <dd className="inline text-ink/75">{row.config.typographyProfile}</dd>
                </div>
                <div>
                  <dt className="inline text-ink/40">Gövde: </dt>
                  <dd className="inline text-ink/75">{labelForBodyFont(row.config.fonts.body)}</dd>
                </div>
                <div>
                  <dt className="inline text-ink/40">Editoryal: </dt>
                  <dd className="inline text-ink/75">{labelForDisplayFont(row.config.fonts.display)}</dd>
                </div>
              </dl>
              <p className="mt-2 text-xs text-ink/40">
                {new Date(row.createdAt).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })}
                {row.publicationNote ? ` · ${row.publicationNote}` : ""}
              </p>
            </div>
            <div className="shrink-0">
              <ConfirmAction
                trigger="Geri yükle"
                triggerVariant="outline"
                title={`Sürüm ${row.version} geri yüklensin mi?`}
                description={
                  isCurrent
                    ? "Bu sürüm zaten yayında. Geri yükleme, yeni bir sürüm oluşturur ancak görsel değişiklik olmaz."
                    : "Bu, seçili sürümün yapılandırmasını yeni bir sürüm olarak yayınlar. Mevcut yayındaki tema değişir; geçmiş sürümler korunur."
                }
                entityName={`Sürüm ${row.version} — ${preset.label}`}
                confirmLabel="Geri yükle ve yayınla"
                pendingLabel="Geri yükleniyor…"
                tone="primary"
                action={restoreRevisionFormAction}
                hiddenFields={{ version: String(row.version) }}
              >
                <label className="flex flex-col">
                  <span className="label mb-1.5 text-olive">Yayın notu (isteğe bağlı)</span>
                  <input
                    name="note"
                    autoComplete="off"
                    className="min-h-11 rounded-[3px] border border-ink/15 bg-ivory px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/40"
                    placeholder={`Sürüm ${row.version} geri yüklendi`}
                  />
                </label>
              </ConfirmAction>
            </div>
          </li>
        )
      })}
    </ul>
  )
}