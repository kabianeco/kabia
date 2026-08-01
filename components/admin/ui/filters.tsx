"use client"

import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Search, X } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Server-backed list filters.
 *
 * Filtering and searching happen in Postgres against indexed columns; this is
 * only the control surface. The search box debounces (350ms) and skips
 * single-character queries, so typing "badem" issues one request rather than
 * five, and never an unbounded one — the page it navigates to always applies a
 * LIMIT.
 *
 * State lives in the URL, which means a filtered view is shareable, survives a
 * refresh, and works with the browser's back button for free.
 */

const DEBOUNCE_MS = 350

function useQueryWriter() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const write = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") params.delete(key)
        else params.set(key, value)
      }
      // Any filter change invalidates the current page offset.
      if (!("page" in updates)) params.delete("page")
      const query = params.toString()
      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
      })
    },
    [pathname, router, searchParams],
  )

  return { write, isPending, searchParams }
}

export function SearchField({
  placeholder = "Ara…",
  label = "Ara",
  paramName = "q",
  hint,
}: {
  placeholder?: string
  label?: string
  paramName?: string
  hint?: string
}) {
  const { write, isPending, searchParams } = useQueryWriter()
  const initial = searchParams.get(paramName) ?? ""
  const [value, setValue] = useState(initial)
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Tracks what the URL last held, so an external navigation (back button,
  // "clear all") re-syncs the input without fighting the user's typing.
  const lastPushed = useRef(initial)

  useEffect(() => {
    if (initial !== lastPushed.current) {
      lastPushed.current = initial
      setValue(initial)
    }
  }, [initial])

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  const schedule = useCallback(
    (next: string) => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        const trimmed = next.trim()
        // One character matches almost everything; it is a wasted round trip.
        if (trimmed.length === 1) return
        lastPushed.current = trimmed
        write({ [paramName]: trimmed || null })
      }, DEBOUNCE_MS)
    },
    [paramName, write],
  )

  return (
    <div className="min-w-0 flex-1 sm:max-w-xs">
      <label htmlFor={id} className="label mb-1.5 block text-olive">
        {label}
      </label>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35"
        />
        <input
          id={id}
          type="search"
          value={value}
          placeholder={placeholder}
          aria-describedby={hintId}
          autoComplete="off"
          onChange={(event) => {
            setValue(event.target.value)
            schedule(event.target.value)
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              if (timer.current) clearTimeout(timer.current)
              lastPushed.current = value.trim()
              write({ [paramName]: value.trim() || null })
            }
          }}
          className="min-h-11 w-full rounded-[3px] border border-ink/15 bg-ivory py-2 pl-9 pr-9 text-sm text-ink placeholder:text-ink/30 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/40"
        />
        {value && (
          <button
            type="button"
            aria-label="Aramayı temizle"
            onClick={() => {
              if (timer.current) clearTimeout(timer.current)
              setValue("")
              lastPushed.current = ""
              write({ [paramName]: null })
            }}
            className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-ink/40 transition-colors duration-200 hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-ink/40">
          {hint}
        </p>
      )}
      <span className="sr-only" aria-live="polite">
        {isPending ? "Sonuçlar güncelleniyor" : ""}
      </span>
    </div>
  )
}

export function FilterSelect({
  label,
  paramName,
  options,
  allLabel = "Tümü",
  className,
}: {
  label: string
  paramName: string
  options: { value: string; label: string }[]
  allLabel?: string
  className?: string
}) {
  const { write, searchParams } = useQueryWriter()
  const id = useId()
  const current = searchParams.get(paramName) ?? ""

  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={id} className="label mb-1.5 block text-olive">
        {label}
      </label>
      <select
        id={id}
        value={current}
        onChange={(event) => write({ [paramName]: event.target.value || null })}
        className="min-h-11 w-full cursor-pointer rounded-[3px] border border-ink/15 bg-ivory px-3 py-2 pr-8 text-sm text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/40 sm:w-auto"
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export function DateRangeFilter({
  fromParam = "from",
  toParam = "to",
}: {
  fromParam?: string
  toParam?: string
}) {
  const { write, searchParams } = useQueryWriter()
  const fromId = useId()
  const toId = useId()
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label htmlFor={fromId} className="label mb-1.5 block text-olive">
          Başlangıç
        </label>
        <input
          id={fromId}
          type="date"
          defaultValue={searchParams.get(fromParam) ?? ""}
          onChange={(event) => write({ [fromParam]: event.target.value || null })}
          className="min-h-11 rounded-[3px] border border-ink/15 bg-ivory px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/40"
        />
      </div>
      <div>
        <label htmlFor={toId} className="label mb-1.5 block text-olive">
          Bitiş
        </label>
        <input
          id={toId}
          type="date"
          defaultValue={searchParams.get(toParam) ?? ""}
          onChange={(event) => write({ [toParam]: event.target.value || null })}
          className="min-h-11 rounded-[3px] border border-ink/15 bg-ivory px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/40"
        />
      </div>
    </div>
  )
}

export function ClearFilters({ params }: { params: string[] }) {
  const { write, searchParams } = useQueryWriter()
  const active = params.some((param) => searchParams.get(param))
  if (!active) return null
  return (
    <button
      type="button"
      onClick={() => write(Object.fromEntries(params.map((param) => [param, null])))}
      className="inline-flex min-h-11 items-center gap-1.5 text-sm text-ink/55 transition-colors duration-300 hover:text-ink"
    >
      <X className="h-3.5 w-3.5" aria-hidden="true" />
      Filtreleri temizle
    </button>
  )
}

/** Layout shell so every list screen's filter row lines up identically. */
export function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end gap-3 rounded-[4px] border border-ink/10 bg-paper/40 px-4 py-3">
      {children}
    </div>
  )
}
