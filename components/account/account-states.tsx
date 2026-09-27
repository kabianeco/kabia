"use client";

import type { ReactNode } from "react";
import { ArrowLink } from "@/components/ui/button";

/** Page heading for the account area: one title, at most one quiet line. */
export function AccountHeading({ title, lead, children }: { title: ReactNode; lead?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-3xl tracking-tight md:text-4xl">{title}</h1>
        {lead && <p className="mt-4 max-w-md text-sm leading-relaxed text-ink/60">{lead}</p>}
      </div>
      {children}
    </div>
  );
}

/**
 * Loading: a few hairline rows in the shape of what is coming, announced as
 * busy. Pulses only when motion is allowed.
 */
export function AccountLoading({ label, rows = 3 }: { label: string; rows?: number }) {
  return (
    <div role="status" aria-busy="true" className="mt-12 border-t border-ink/10">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="border-b border-ink/10 py-6">
          <div className="h-4 w-1/3 rounded-media bg-paper motion-safe:animate-pulse" />
          <div className="mt-3 h-3 w-1/2 rounded-media bg-paper motion-safe:animate-pulse" />
        </div>
      ))}
    </div>
  );
}

/** Could not load: says so plainly, offers one retry. Never shown as "empty". */
export function AccountError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="mt-10 max-w-md">
      <p className="text-base leading-relaxed text-ink/70">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex min-h-11 items-center text-sm text-brand transition-colors duration-300 hover:text-forest"
        >
          Tekrar dene
        </button>
      )}
    </div>
  );
}

/** Nothing here yet: one sentence and the one useful next step. */
export function AccountEmpty({ children, action }: { children: ReactNode; action?: { href: string; label: string } }) {
  return (
    <div className="mt-10 max-w-md">
      <p className="text-base leading-relaxed text-ink/60">{children}</p>
      {action && (
        <div className="mt-6">
          <ArrowLink href={action.href}>{action.label}</ArrowLink>
        </div>
      )}
    </div>
  );
}
