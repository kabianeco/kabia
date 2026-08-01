/**
 * Chart parameters for the Kabia dashboard.
 *
 * Colour decision, and why it is what it is:
 *
 * The obvious move was to paint order statuses with the palette's own status
 * tones — tan for preparing, green for delivered, rust for cancelled. Running
 * those through the palette validator killed the idea:
 *
 *   green #147b4b ↔ rust #a4442f   ΔE 4.4 (deuteranopia), light mode
 *   green #35a76f ↔ rust #e0705a   ΔE 5.6 (deuteranopia), dark mode
 *   tan   #c29a63 ↔ rust #e0705a   ΔE 13.0 (normal vision), dark mode
 *
 * That is the textbook red/green collision: a deuteranope reading this
 * dashboard could not tell a delivered order from a cancelled one, and in dark
 * mode even full-colour vision struggles with tan against rust. The palette is
 * right for the storefront; it is not a categorical chart palette.
 *
 * So every chart here uses ONE hue. Identity is carried by axis labels and
 * printed values — text, which is legible to everyone — and colour only ever
 * encodes "this is data". Two measures are never put on one pair of axes;
 * revenue, orders and signups are separate plots at a shared time scale.
 *
 * Colours are CSS custom properties rather than hex literals, so SVG marks
 * follow the light/dark theme with the rest of the interface instead of needing
 * a second, hand-flipped palette.
 */

export const CHART_COLORS = {
  /** The single data hue. */
  mark: "var(--color-brand)",
  /** Fill under a line; low alpha so the grid stays readable through it. */
  markFill: "color-mix(in srgb, var(--color-brand) 18%, transparent)",
  grid: "color-mix(in srgb, var(--color-ink) 10%, transparent)",
  axis: "color-mix(in srgb, var(--color-ink) 45%, transparent)",
  surface: "var(--color-ivory)",
  border: "color-mix(in srgb, var(--color-ink) 14%, transparent)",
  ink: "var(--color-ink)",
} as const

export const AXIS_TICK = {
  fontSize: 11,
  fill: CHART_COLORS.axis,
  fontFamily: "var(--font-sans)",
} as const

/** Recharts renders its own DOM; the tooltip is styled to match the panels. */
export const TOOLTIP_STYLE = {
  backgroundColor: "var(--color-ivory)",
  border: "1px solid color-mix(in srgb, var(--color-ink) 14%, transparent)",
  borderRadius: "3px",
  fontSize: "12px",
  fontFamily: "var(--font-sans)",
  color: "var(--color-ink)",
  boxShadow: "none",
  padding: "8px 10px",
} as const

export const CHART_HEIGHT = 260
export const MINI_CHART_HEIGHT = 120
