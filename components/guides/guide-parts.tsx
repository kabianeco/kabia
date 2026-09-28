import Link from "next/link"
import type { ReactNode } from "react"
import { Breadcrumbs, type Crumb } from "@/components/layout/breadcrumbs"

/**
 * The /rehber pages are story pages: these parts are the /badem page's own
 * blocks (header, notes grid, bordered section, numbered steps, closing call
 * to action) with its classes unchanged, so a guide looks like the story
 * pages it sits beside and introduces no new design.
 */

export function GuideHeader({
  crumbs,
  eyebrow,
  heading,
  intro,
}: {
  crumbs: readonly Crumb[]
  eyebrow: string
  heading: readonly [string, string, string]
  intro?: ReactNode
}) {
  const [plain, display, tail] = heading
  return (
    <div className="wrap page-top pb-16 md:pb-24">
      <Breadcrumbs items={crumbs} />
      <p className="label text-olive">{eyebrow}</p>
      <h1 id="guide-heading" className="mt-6 max-w-3xl text-4xl leading-[1.08] tracking-tight md:text-6xl">
        {plain}
        <em className="font-theme-display italic text-brand">{display}</em>
        {tail}
      </h1>
      {intro ? <p className="mt-7 max-w-md text-base leading-relaxed text-ink/65">{intro}</p> : null}
    </div>
  )
}

export function GuideNotes({ notes }: { notes: readonly { title: ReactNode; body: ReactNode }[] }) {
  return (
    <ul className="grid grid-cols-1 gap-x-8 gap-y-10 pb-16 sm:grid-cols-2 md:pb-24 lg:grid-cols-3">
      {notes.map((note, index) => (
        <li key={index} className="border-t border-ink/10 pt-6">
          <h2 className="text-xl tracking-tight">{note.title}</h2>
          <div className="mt-3 max-w-md text-sm leading-relaxed text-ink/65">{note.body}</div>
        </li>
      ))}
    </ul>
  )
}

export function GuideSection({ heading, id, children }: { heading: ReactNode; id?: string; children?: ReactNode }) {
  return (
    <div id={id} className="border-t border-ink/10 py-16 md:py-20">
      <h2 className="max-w-xl text-2xl tracking-tight md:text-3xl">{heading}</h2>
      {children ? <div className="mt-5 max-w-prose text-base leading-relaxed text-ink/70">{children}</div> : null}
    </div>
  )
}

export function GuideSteps({
  steps,
}: {
  steps: readonly { key: string; marker: ReactNode; title: ReactNode; body: ReactNode }[]
}) {
  return (
    <ol className="pb-24 md:pb-8">
      {steps.map((step) => (
        <li
          key={step.key}
          className="grid gap-2 border-t border-ink/10 py-8 md:grid-cols-12 md:gap-8 md:py-10"
        >
          <span aria-hidden="true" className="font-serif text-xl text-shell md:col-span-1">
            {step.marker}
          </span>
          <h3 className="text-2xl tracking-tight md:col-span-3">{step.title}</h3>
          <div className="max-w-md text-sm leading-relaxed text-ink/60 md:col-span-6 md:col-start-6">{step.body}</div>
        </li>
      ))}
    </ol>
  )
}

/** A quiet in-text link, as the journal's related-pages links are set. */
export function GuideLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="inline-flex min-h-11 items-center gap-2 text-sm text-brand transition-colors duration-300 hover:text-ink"
    >
      {children}
      <span aria-hidden="true">→</span>
    </Link>
  )
}

export function GuideClosing({
  eyebrow,
  line,
  primary,
  links,
}: {
  eyebrow: string
  line: string
  primary?: { href: string; label: string }
  links: readonly { href: string; label: string }[]
}) {
  return (
    <div className="border-t border-ink/10 py-16 text-center md:py-24">
      <p className="label text-olive">{eyebrow}</p>
      <p className="mx-auto mt-6 max-w-xl font-theme-display text-2xl italic leading-snug md:text-4xl">{line}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {primary ? (
          <Link
            href={primary.href}
            className="inline-flex min-h-11 items-center rounded-full bg-brand px-7 text-sm font-medium text-on-brand transition-colors duration-300 hover:bg-forest"
          >
            {primary.label}
          </Link>
        ) : null}
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="inline-flex min-h-11 items-center gap-2 text-sm text-ink/60 transition-colors duration-300 hover:text-ink"
          >
            {link.label}
            <span aria-hidden="true">→</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

/** A definition list in the journal entry's field style. */
export function GuideFacts({ facts }: { facts: readonly { label: string; value: ReactNode }[] }) {
  return (
    <dl className="mt-6">
      {facts.map((fact) => (
        <div key={fact.label} className="border-t border-ink/10 py-5">
          <dt className="label text-olive">{fact.label}</dt>
          <dd className="mt-2 text-sm leading-relaxed text-ink/70 md:text-base">{fact.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * A listing page's second intro paragraph: the first paragraph's own style,
 * with the guide link set like /ciftlik's inline certificate link.
 */
export function ListingIntro({ text, link }: { text: string; link: { href: string; label: string } }) {
  return (
    <p className="mt-4 max-w-md text-base leading-relaxed text-ink/65">
      {text}{" "}
      <Link
        href={link.href}
        prefetch={false}
        className="underline decoration-ink/25 underline-offset-4 transition-colors duration-300 hover:text-ink hover:decoration-ink/60"
      >
        {link.label}
      </Link>
    </p>
  )
}
