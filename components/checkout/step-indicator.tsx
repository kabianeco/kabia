"use client";

import { STEP_LABELS, STEP_ORDER, type StepId } from "./types";

/**
 * Checkout is a real sequence, so the steps are numbered. Set as a hairline
 * ledger rather than circles-and-connectors.
 */
export function StepIndicator({
  current,
  furthestIndex,
  onNavigate,
}: {
  current: StepId;
  furthestIndex: number;
  onNavigate: (step: StepId) => void;
}) {
  const visibleSteps = STEP_ORDER.filter((s) => s !== "confirmation");

  return (
    <nav aria-label="Ödeme adımları">
      <ol className="flex border-t border-ink/10">
        {visibleSteps.map((step, i) => {
          const stepIndex = STEP_ORDER.indexOf(step);
          const isCurrent = step === current;
          const isClickable =
            stepIndex <= furthestIndex && current !== "confirmation" && !isCurrent;

          return (
            <li key={step} className="flex-1">
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => isClickable && onNavigate(step)}
                aria-current={isCurrent ? "step" : undefined}
                className={`flex min-h-14 w-full items-baseline gap-3 border-t-2 pt-4 text-left transition-colors duration-300 ${
                  isCurrent
                    ? "border-brand text-ink"
                    : stepIndex < furthestIndex
                      ? "border-brand/30 text-ink/70 hover:text-ink"
                      : "border-transparent text-ink/35"
                } ${isClickable ? "cursor-pointer" : "cursor-default"}`}
              >
                <span className="font-serif text-lg text-shell">0{i + 1}</span>
                <span className="text-sm">{STEP_LABELS[step]}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
