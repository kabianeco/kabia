"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  AXIS_TICK,
  CHART_COLORS,
  CHART_HEIGHT,
  MINI_CHART_HEIGHT,
  TOOLTIP_STYLE,
} from "./chart-theme"
import { formatCurrency, formatDayMonth, formatInteger } from "@/lib/admin/format"

/**
 * Time-series plots. One measure per chart, one hue per chart — never two
 * y-scales sharing an x-axis.
 *
 * Each chart ships with a crosshair tooltip *and* a collapsible data table, so
 * the same numbers are reachable by keyboard and by a screen reader rather than
 * only by hovering a shape.
 */

export interface SeriesPoint {
  date: string
  revenue: number
  orders: number
  customers: number
}

function EmptyPlot({ message }: { message: string }) {
  return (
    <div
      className="flex items-center justify-center rounded-[3px] border border-dashed border-ink/15 text-center"
      style={{ height: CHART_HEIGHT }}
    >
      <p className="px-4 text-sm text-ink/45">{message}</p>
    </div>
  )
}

function DataTable({
  data,
  label,
  valueLabel,
  format,
  field,
}: {
  data: SeriesPoint[]
  label: string
  valueLabel: string
  format: (value: number) => string
  field: keyof Omit<SeriesPoint, "date">
}) {
  return (
    <details className="mt-3 group">
      <summary className="inline-flex min-h-11 cursor-pointer items-center text-xs text-ink/50 transition-colors duration-200 hover:text-ink">
        Tabloyu göster
      </summary>
      <div className="mt-2 max-h-64 overflow-y-auto rounded-[3px] border border-ink/10">
        <table className="w-full text-xs">
          <caption className="sr-only">{label}</caption>
          <thead className="sticky top-0 bg-paper">
            <tr>
              <th scope="col" className="label px-3 py-2 text-left text-olive">
                Tarih
              </th>
              <th scope="col" className="label px-3 py-2 text-right text-olive">
                {valueLabel}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((point) => (
              <tr key={point.date} className="border-t border-ink/[0.06]">
                <td className="px-3 py-1.5 text-ink/70">{formatDayMonth(point.date)}</td>
                <td className="figure px-3 py-1.5 text-right text-ink">
                  {format(point[field])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

export function RevenueChart({ data }: { data: SeriesPoint[] }) {
  const hasValues = data.some((point) => point.revenue > 0)
  if (!hasValues) {
    return <EmptyPlot message="Seçilen aralıkta gelir kaydı yok." />
  }

  return (
    <figure className="m-0">
      <figcaption className="sr-only">
        Seçilen dönemdeki günlük gelir. İptal edilen siparişler hariçtir.
      </figcaption>
      <div style={{ height: CHART_HEIGHT }} role="img" aria-label="Günlük gelir grafiği">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDayMonth}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: CHART_COLORS.grid }}
              minTickGap={24}
            />
            <YAxis
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={72}
              tickFormatter={(value: number) => formatCurrency(value)}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              cursor={{ stroke: CHART_COLORS.axis, strokeWidth: 1 }}
              labelFormatter={(value) => formatDayMonth(String(value))}
              formatter={(value) => [formatCurrency(Number(value ?? 0)), "Gelir"]}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke={CHART_COLORS.mark}
              strokeWidth={2}
              fill={CHART_COLORS.markFill}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: CHART_COLORS.surface }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <DataTable
        data={data}
        label="Günlük gelir"
        valueLabel="Gelir"
        format={formatCurrency}
        field="revenue"
      />
    </figure>
  )
}

export function MiniTrend({
  data,
  field,
  title,
  emptyMessage,
}: {
  data: SeriesPoint[]
  field: "orders" | "customers"
  title: string
  emptyMessage: string
}) {
  const hasValues = data.some((point) => point[field] > 0)

  if (!hasValues) {
    return (
      <div
        className="flex items-center justify-center rounded-[3px] border border-dashed border-ink/15"
        style={{ height: MINI_CHART_HEIGHT }}
      >
        <p className="px-4 text-center text-xs text-ink/45">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <figure className="m-0">
      <figcaption className="sr-only">{title}</figcaption>
      <div style={{ height: MINI_CHART_HEIGHT }} role="img" aria-label={title}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDayMonth}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: CHART_COLORS.grid }}
              minTickGap={36}
            />
            <YAxis
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={32}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              cursor={{ stroke: CHART_COLORS.axis, strokeWidth: 1 }}
              labelFormatter={(value) => formatDayMonth(String(value))}
              formatter={(value) => [formatInteger(Number(value ?? 0)), title]}
            />
            <Line
              type="monotone"
              dataKey={field}
              stroke={CHART_COLORS.mark}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: CHART_COLORS.surface }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <DataTable
        data={data}
        label={title}
        valueLabel={title}
        format={formatInteger}
        field={field}
      />
    </figure>
  )
}
