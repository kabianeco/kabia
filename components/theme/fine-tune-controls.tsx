"use client"

import { useId } from "react"
import { cn } from "@/lib/utils"
import { getPreset } from "@/lib/theme-engine/presets"
import type {
  DensityLevel,
  IconSizeScale,
  PageSizeGutter,
  ShadowStrength,
  StockBadgeFill,
  StockBadgePosition,
  StockBadgeTone,
  ThemeConfiguration,
  ThemeOverrides,
} from "@/lib/theme-engine/types"

/**
 * Constrained fine-tuning controls. Every field is bounded to an approved
 * allowlist — no unrestricted numeric inputs. Each group shows the current
 * value against the preset default and may be reset independently. Updates are
 * reflected into the editor's local state immediately (and into the scoped
 * preview), but never written to Supabase until the operator saves.
 */

const RADIUS_VALUES = [0, 2, 4, 6, 8, 12, 16, 20, 24, 28, 32, 999]
const BORDER_WIDTHS = [0, 1, 2]
const BORDER_OPACITIES = [0.08, 0.12, 0.18, 0.24, 0.32]
const ICON_STROKES = [1.25, 1.4, 1.5, 1.6, 1.75, 2]
const SHADOW_LABELS: Record<ShadowStrength, string> = {
  none: "Yok",
  subtle: "Hafif",
  medium: "Orta",
  strong: "Güçlü",
}
const DENSITY_LABELS: Record<DensityLevel, string> = {
  compact: "Kompakt",
  balanced: "Dengeli",
  spacious: "Ferah",
}
const GUTTER_LABELS: Record<PageSizeGutter, string> = {
  compact: "Kompakt",
  balanced: "Dengeli",
  wide: "Geniş",
}
const ICON_SCALE_LABELS: Record<IconSizeScale, string> = {
  compact: "Kompakt",
  balanced: "Dengeli",
  large: "Geniş",
}
const STOCK_BADGE_VISIBILITY_VALUES = ["true", "false"] as const
const STOCK_BADGE_VISIBILITY_LABELS: Record<"true" | "false", string> = {
  true: "Göster",
  false: "Gizle",
}
const STOCK_BADGE_TONE_VALUES: StockBadgeTone[] = ["clay", "ink", "brand", "olive", "shell"]
const STOCK_BADGE_TONE_LABELS: Record<StockBadgeTone, string> = {
  clay: "Kil",
  ink: "İnk",
  brand: "Marka",
  olive: "Zeytin",
  shell: "Kabuk",
}
const STOCK_BADGE_FILL_VALUES: StockBadgeFill[] = ["solid", "outline", "text"]
const STOCK_BADGE_FILL_LABELS: Record<StockBadgeFill, string> = {
  solid: "Dolu",
  outline: "Anahat",
  text: "Sade metin",
}
const STOCK_BADGE_POSITION_VALUES: StockBadgePosition[] = ["top-left", "top-right", "bottom-left", "bottom-right"]
const STOCK_BADGE_POSITION_LABELS: Record<StockBadgePosition, string> = {
  "top-left": "Sol üst",
  "top-right": "Sağ üst",
  "bottom-left": "Sol alt",
  "bottom-right": "Sağ alt",
}
const STOCK_BADGE_INSET_VALUES = [0, 2, 4, 8, 12, 16]

interface GroupProps {
  legend: string
  description?: string
  onReset?: () => void
  children: React.ReactNode
}

function Group({ legend, description, onReset, children }: GroupProps) {
  const id = useId()
  return (
    <fieldset className="rounded-[4px] border border-ink/10 bg-paper/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <legend className="label text-olive">{legend}</legend>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="text-xs text-ink/45 transition-colors duration-200 hover:text-brand"
          >
            Grubu sıfırla
          </button>
        )}
      </div>
      {description && <p className="mt-1 text-xs leading-relaxed text-ink/45">{description}</p>}
      <div className="mt-4" id={id}>
        {children}
      </div>
    </fieldset>
  )
}

function Segmented<T extends number | string>({
  label,
  value,
  values,
  labels,
  defaultValue,
  onChange,
}: {
  label: string
  value: T | undefined
  values: readonly T[]
  labels?: Record<T, string>
  defaultValue: T
  onChange: (v: T) => void
}) {
  const current = value ?? defaultValue
  return (
    <div className="border-t border-ink/10 py-3 first:border-t-0 first:pt-0">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-sm text-ink/80">{label}</span>
        <span className="text-xs text-ink/45">
          {String(current)} {value !== undefined && value !== defaultValue && <span className="text-shell">· varsayılan {String(defaultValue)}</span>}
        </span>
      </div>
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={label}>
        {values.map((v) => (
          <button
            key={String(v)}
            type="button"
            role="radio"
            aria-checked={v === current}
            onClick={() => onChange(v)}
            className={cn(
              "min-h-9 rounded-[3px] border px-3 py-1 text-xs transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
              v === current ? "border-brand bg-brand/10 text-brand" : "border-ink/15 bg-ivory text-ink/70 hover:border-ink/30",
            )}
          >
            {labels?.[v] ?? String(v)}
          </button>
        ))}
      </div>
    </div>
  )
}

export function FineTuneControls({
  config,
  onOverride,
  onResetGroup,
}: {
  config: ThemeConfiguration
  onOverride: (path: { group: keyof ThemeOverrides; key: string; value: unknown }) => void
  onResetGroup: (group: keyof ThemeOverrides) => void
}) {
  const preset = getPreset(config.shapePreset)
  const ov = config.overrides

  return (
    <div className="space-y-4">
      <Group legend="Yarıçap" description="Bileşen köşelerini preset üzerinde ince ayarlar." onReset={() => onResetGroup("radius")}>
        <Segmented label="Buton" value={ov.radius?.button} values={RADIUS_VALUES} defaultValue={preset.radius.button} onChange={(v) => onOverride({ group: "radius", key: "button", value: v })} />
        <Segmented label="Görsel" value={ov.radius?.image} values={RADIUS_VALUES} defaultValue={preset.radius.image} onChange={(v) => onOverride({ group: "radius", key: "image", value: v })} />
        <Segmented label="Ürün görseli" value={ov.radius?.productImage} values={RADIUS_VALUES} defaultValue={preset.radius.productImage} onChange={(v) => onOverride({ group: "radius", key: "productImage", value: v })} />
        <Segmented label="Kart" value={ov.radius?.card} values={RADIUS_VALUES} defaultValue={preset.radius.card} onChange={(v) => onOverride({ group: "radius", key: "card", value: v })} />
        <Segmented label="Form alanı" value={ov.radius?.input} values={RADIUS_VALUES} defaultValue={preset.radius.input} onChange={(v) => onOverride({ group: "radius", key: "input", value: v })} />
        <Segmented label="Diyalog" value={ov.radius?.dialog} values={RADIUS_VALUES} defaultValue={preset.radius.dialog} onChange={(v) => onOverride({ group: "radius", key: "dialog", value: v })} />
        <Segmented label="Etiket" value={ov.radius?.badge} values={RADIUS_VALUES} defaultValue={preset.radius.badge} onChange={(v) => onOverride({ group: "radius", key: "badge", value: v })} />
        <Segmented label="Navigasyon" value={ov.radius?.navigation} values={RADIUS_VALUES} defaultValue={preset.radius.navigation} onChange={(v) => onOverride({ group: "radius", key: "navigation", value: v })} />
        <Segmented label="İkon konteyneri" value={ov.radius?.iconContainer} values={RADIUS_VALUES} defaultValue={preset.radius.iconContainer} onChange={(v) => onOverride({ group: "radius", key: "iconContainer", value: v })} />
      </Group>

      <Group legend="Kenarlık" onReset={() => onResetGroup("border")}>
        <Segmented label="Kenarlık kalınlığı" value={ov.border?.width} values={BORDER_WIDTHS} defaultValue={preset.border.width} onChange={(v) => onOverride({ group: "border", key: "width", value: v })} />
        <Segmented
          label="Kenarlık opaklığı"
          value={ov.border?.opacity}
          values={BORDER_OPACITIES}
          defaultValue={preset.border.opacity}
          onChange={(v) => onOverride({ group: "border", key: "opacity", value: v })}
        />
        <Segmented
          label="Üst bilgi bölücü opaklığı"
          value={ov.border?.headerDividerOpacity}
          values={BORDER_OPACITIES}
          defaultValue={preset.border.headerDividerOpacity}
          onChange={(v) => onOverride({ group: "border", key: "headerDividerOpacity", value: v })}
        />
      </Group>

      <Group legend="Gölge" onReset={() => onResetGroup("shadow")}>
        <Segmented label="Kart gölgesi" value={ov.shadow?.card as ShadowStrength | undefined} values={["none", "subtle", "medium", "strong"]} labels={SHADOW_LABELS} defaultValue={preset.shadow.card} onChange={(v) => onOverride({ group: "shadow", key: "card", value: v })} />
        <Segmented label="Görsel gölgesi" value={ov.shadow?.image as ShadowStrength | undefined} values={["none", "subtle", "medium", "strong"]} labels={SHADOW_LABELS} defaultValue={preset.shadow.image} onChange={(v) => onOverride({ group: "shadow", key: "image", value: v })} />
        <Segmented label="Diyalog gölgesi" value={ov.shadow?.dialog as ShadowStrength | undefined} values={["subtle", "medium", "strong"]} labels={SHADOW_LABELS} defaultValue={preset.shadow.dialog} onChange={(v) => onOverride({ group: "shadow", key: "dialog", value: v })} />
        <Segmented label="Yüzen navigasyon gölgesi" value={ov.shadow?.floatingNavigation as ShadowStrength | undefined} values={["none", "subtle", "medium", "strong"]} labels={SHADOW_LABELS} defaultValue={preset.shadow.floatingNavigation} onChange={(v) => onOverride({ group: "shadow", key: "floatingNavigation", value: v })} />
      </Group>

      <Group legend="İkon" onReset={() => onResetGroup("icon")}>
        <Segmented label="İkon çizgi kalınlığı" value={ov.icon?.strokeWidth} values={ICON_STROKES} defaultValue={preset.icon.strokeWidth} onChange={(v) => onOverride({ group: "icon", key: "strokeWidth", value: v })} />
        <Segmented label="İkon boyutu" value={ov.icon?.sizeScale as IconSizeScale | undefined} values={["compact", "balanced", "large"]} labels={ICON_SCALE_LABELS} defaultValue={preset.icon.sizeScale} onChange={(v) => onOverride({ group: "icon", key: "sizeScale", value: v })} />
      </Group>

      <Group legend="Yoğunluk" onReset={() => onResetGroup("density")}>
        <Segmented label="Arayüz yoğunluğu" value={ov.density?.interface as DensityLevel | undefined} values={["compact", "balanced", "spacious"]} labels={DENSITY_LABELS} defaultValue={preset.density.interface} onChange={(v) => onOverride({ group: "density", key: "interface", value: v })} />
        <Segmented label="Bölüm aralığı" value={ov.density?.sectionSpacing as DensityLevel | undefined} values={["compact", "balanced", "spacious"]} labels={DENSITY_LABELS} defaultValue={preset.density.sectionSpacing} onChange={(v) => onOverride({ group: "density", key: "sectionSpacing", value: v })} />
        <Segmented label="Sayfa kenar boşluğu" value={ov.density?.pageGutter as PageSizeGutter | undefined} values={["compact", "balanced", "wide"]} labels={GUTTER_LABELS} defaultValue={preset.density.pageGutter} onChange={(v) => onOverride({ group: "density", key: "pageGutter", value: v })} />
      </Group>

      <Group
        legend="Stok rozeti"
        description="Ürün görseli üzerindeki 'Stokta yok' rozetinin görünümü. Kartın altındaki metin satırı bundan etkilenmez, her zaman görünür."
        onReset={() => onResetGroup("stockBadge")}
      >
        <Segmented
          label="Görünürlük"
          value={ov.stockBadge?.visible === undefined ? undefined : ov.stockBadge.visible ? "true" : "false"}
          values={STOCK_BADGE_VISIBILITY_VALUES}
          labels={STOCK_BADGE_VISIBILITY_LABELS}
          defaultValue="true"
          onChange={(v) => onOverride({ group: "stockBadge", key: "visible", value: v === "true" })}
        />
        <Segmented
          label="Renk"
          value={ov.stockBadge?.tone}
          values={STOCK_BADGE_TONE_VALUES}
          labels={STOCK_BADGE_TONE_LABELS}
          defaultValue="clay"
          onChange={(v) => onOverride({ group: "stockBadge", key: "tone", value: v })}
        />
        <Segmented
          label="Dolgu"
          value={ov.stockBadge?.fill}
          values={STOCK_BADGE_FILL_VALUES}
          labels={STOCK_BADGE_FILL_LABELS}
          defaultValue="solid"
          onChange={(v) => onOverride({ group: "stockBadge", key: "fill", value: v })}
        />
        <Segmented
          label="Konum"
          value={ov.stockBadge?.position}
          values={STOCK_BADGE_POSITION_VALUES}
          labels={STOCK_BADGE_POSITION_LABELS}
          defaultValue="top-left"
          onChange={(v) => onOverride({ group: "stockBadge", key: "position", value: v })}
        />
        <Segmented
          label="Kenar boşluğu"
          value={ov.stockBadge?.inset}
          values={STOCK_BADGE_INSET_VALUES}
          defaultValue={8}
          onChange={(v) => onOverride({ group: "stockBadge", key: "inset", value: v })}
        />
        <Segmented
          label="Köşe yuvarlaklığı"
          value={ov.stockBadge?.radius}
          values={RADIUS_VALUES}
          defaultValue={0}
          onChange={(v) => onOverride({ group: "stockBadge", key: "radius", value: v })}
        />
      </Group>
    </div>
  )
}