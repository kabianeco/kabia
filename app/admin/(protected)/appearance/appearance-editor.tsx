"use client"

import { useMemo, useState } from "react"
import { useActionState } from "react"
import { Panel } from "@/components/admin/ui/surfaces"
import { AdminButton, SubmitButton, FormMessage } from "@/components/admin/ui/form"
import { ConfirmAction } from "@/components/admin/ui/confirm-dialog"
import { PresetCards } from "@/components/theme/preset-cards"
import { TypographyPreview } from "@/components/theme/typography-preview"
import { FineTuneControls } from "@/components/theme/fine-tune-controls"
import { AppearancePreview } from "@/components/theme/appearance-preview"
import { RevisionHistory } from "@/components/theme/revision-history"
import { getPreset } from "@/lib/theme-engine/presets"
import { getProfile } from "@/lib/theme-engine/profiles"
import {
  selectPreset,
  selectProfile,
  setBodyFont,
  setDisplayFont,
  applyOverride as applyOverrideTransform,
  resetGroup as resetGroupTransform,
  resetOverrides,
  isDirty,
} from "@/lib/theme-engine/editor-logic"
import type { ThemeRevisionRow } from "@/lib/theme-settings"
import type {
  BodyFontId,
  DisplayFontId,
  ShapePresetId,
  ThemeConfiguration,
  ThemeOverrides,
  TypographyProfileId,
} from "@/lib/theme-engine/types"
import { ACTION_IDLE } from "@/lib/admin/errors"
import {
  saveDraftAction,
  discardDraftFormAction,
  publishThemeFormAction,
  enterPreviewAction,
} from "./actions"

/**
 * The appearance editor. Local React state holds the *working* configuration
 * (the thing the operator is shaping), which seeds the live preview with zero
 * database writes. Save persists it as the draft; publish promotes the draft
 * to the public site atomically.
 *
 * State indicators:
 *   - "Yayında"   = the published config (server-provided, immutable here)
 *   - "Taslak"    = the saved draft (server-provided)
 *   - "Kaydedilmedi" = the working config differs from the saved draft
 */
export function AppearanceEditor({
  publishedConfig,
  draftConfig,
  publishedVersion,
  revisions,
}: {
  publishedConfig: ThemeConfiguration
  draftConfig: ThemeConfiguration | null
  publishedVersion: number
  revisions: ThemeRevisionRow[]
}) {
  // The saved draft is what the operator last persisted (or the published
  // config when no draft exists).
  const savedDraft = draftConfig ?? publishedConfig
  const [working, setWorking] = useState<ThemeConfiguration>(savedDraft)
  const [saveState, saveAction] = useActionState(saveDraftAction, ACTION_IDLE)

  const dirty = useMemo(() => isDirty(working, savedDraft), [working, savedDraft])
  const hasDraft = draftConfig !== null

  function selectPresetHandler(id: ShapePresetId) {
    setWorking((prev) => selectPreset(prev, id))
  }

  function selectProfileHandler(id: TypographyProfileId) {
    setWorking((prev) => selectProfile(prev, id))
  }

  function setBodyFontHandler(id: BodyFontId) {
    setWorking((prev) => setBodyFont(prev, id))
  }

  function setDisplayFontHandler(id: DisplayFontId) {
    setWorking((prev) => setDisplayFont(prev, id))
  }

  function applyOverride(group: keyof ThemeOverrides, key: string, value: unknown) {
    setWorking((prev) => applyOverrideTransform(prev, group, key, value))
  }

  function resetGroup(group: keyof ThemeOverrides) {
    setWorking((prev) => resetGroupTransform(prev, group))
  }

  function resetToPresetDefaults() {
    setWorking((prev) => resetOverrides(prev))
  }

  const configPayload = JSON.stringify(working)

  return (
    <div className="space-y-6">
      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-[4px] border border-ink/10 bg-paper/50 px-4 py-3 text-sm">
        <span className="font-serif text-base text-ink">Görünüm</span>
        <span className="text-ink/30">·</span>
        <span className="text-ink/70">
          Yayında: <span className="text-ink">{getPreset(publishedConfig.shapePreset).label}</span> (sürüm {publishedVersion})
        </span>
        {hasDraft && (
          <>
            <span className="text-ink/30">·</span>
            <span className="text-shell">Taslak: {getPreset(draftConfig!.shapePreset).label}</span>
          </>
        )}
        {dirty && (
          <>
            <span className="text-ink/30">·</span>
            <span className="text-brand">Kaydedilmedi</span>
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(20rem,26rem)]">
        <div className="space-y-6">
          <Panel title="Şekil preseti" description="Keskin, Dengeli veya Yumuşak. Dengeli, mevcut premium kimliğe en yakındır.">
            <PresetCards
              selected={working.shapePreset}
              draftPreset={draftConfig?.shapePreset ?? publishedConfig.shapePreset}
              publishedPreset={publishedConfig.shapePreset}
              onSelect={selectPresetHandler}
            />
          </Panel>

          <Panel title="Tipografi" description="Onaylı fontlar içinden seçim. Editoryal font yalnızca seçili başlık anlarında kullanılır; fiyatlar ve etiketler sabit serifte kalır.">
            <TypographyPreview
              profile={working.typographyProfile}
              bodyFont={working.fonts.body}
              displayFont={working.fonts.display}
              onProfileChange={selectProfileHandler}
              onBodyFontChange={setBodyFontHandler}
              onDisplayFontChange={setDisplayFontHandler}
            />
          </Panel>

          <Panel title="İnce ayar" description="Her grup preset varsayılanına bağımsız sıfırlanabilir. Renkler bu aşamada sabit.">
            <FineTuneControls
              config={working}
              onOverride={({ group, key, value }) => applyOverride(group, key, value)}
              onResetGroup={resetGroup}
            />
          </Panel>

          <Panel title="Sürüm geçmişi" description="Her yayın değişmez bir sürüm oluşturur. Geri yükleme yeni bir sürüm olarak ileriye kopyalar.">
            <RevisionHistory rows={revisions} currentVersion={publishedVersion} />
          </Panel>
        </div>

        {/* Live preview + actions */}
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <AppearancePreview config={working} />

          <FormMessage state={saveState} />

          <form action={saveAction} className="space-y-3">
            <input type="hidden" name="config" value={configPayload} />
            <SubmitButton pendingLabel="Kaydediliyor…" disabled={!dirty} className="w-full">
              Taslağı kaydet
            </SubmitButton>
          </form>

          <form action={discardDraftFormAction}>
            <SubmitButton variant="outline" pendingLabel="Geri alınıyor…" disabled={!hasDraft} className="w-full">
              Taslak değişiklikleri geri al
            </SubmitButton>
          </form>

          <AdminButton variant="ghost" className="w-full" onClick={resetToPresetDefaults}>
            Preset varsayılanlarına sıfırla
          </AdminButton>

          <ConfirmAction
            trigger="Yayınla"
            triggerVariant="primary"
            triggerClassName="w-full"
            title="Tema yayınlanacak"
            description={
              dirty
                ? "Yayınlamadan önce taslağı kaydetmeniz önerilir. Yayınla, taslağı canlı siteye aktarır ve yeni bir sürüm oluşturur."
                : "Bu, taslağı canlı siteye aktarır ve yeni bir sürüm oluşturur. İşlem geri alınamaz ama önceki sürüme dönebilirsiniz."
            }
            entityName={`${getPreset(working.shapePreset).label} · ${getProfile(working.typographyProfile).label}`}
            confirmLabel="Yayınla"
            pendingLabel="Yayınlanıyor…"
            tone="primary"
            action={publishThemeFormAction}
          >
            <label className="flex flex-col">
              <span className="label mb-1.5 text-olive">Yayın notu (isteğe bağlı)</span>
              <input
                name="note"
                autoComplete="off"
                className="min-h-11 rounded-[3px] border border-ink/15 bg-ivory px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/40"
                placeholder="Örn. Yumuşak preset denendi"
              />
            </label>
          </ConfirmAction>

          <form action={enterPreviewAction}>
            <SubmitButton variant="outline" pendingLabel="Açılıyor…" className="w-full">
              Tam siteyi önizle
            </SubmitButton>
          </form>
        </div>
      </div>
    </div>
  )
}