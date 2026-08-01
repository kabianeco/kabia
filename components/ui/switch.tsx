"use client";

import { useId } from "react";

/**
 * Accessible toggle built on a native checkbox, so it is keyboard operable and
 * announced correctly without a headless UI dependency.
 */
export function Switch({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const id = useId();
  const descId = description ? `${id}-desc` : undefined;

  return (
    <div className="flex items-start justify-between gap-6 border-b border-ink/10 py-5">
      <div className="min-w-0">
        <label htmlFor={id} className="cursor-pointer text-sm text-ink">
          {label}
        </label>
        {description && (
          <p id={descId} className="mt-1 text-xs leading-relaxed text-ink/50">
            {description}
          </p>
        )}
      </div>

      <label className="relative inline-flex h-11 shrink-0 cursor-pointer items-center">
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          aria-describedby={descId}
          onChange={(e) => onCheckedChange(e.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className={`block h-6 w-11 rounded-full border transition-colors duration-300 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-brand ${
            checked ? "border-brand bg-brand" : "border-ink/25 bg-transparent"
          }`}
        />
        <span
          aria-hidden="true"
          className={`absolute left-0.5 h-5 w-5 rounded-full transition-transform duration-300 ${
            checked ? "translate-x-5 bg-on-brand" : "translate-x-0 bg-ink/30"
          }`}
        />
      </label>
    </div>
  );
}
