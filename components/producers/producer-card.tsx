import Image from "next/image"
import Link from "next/link"
import { ButtonLink } from "@/components/ui/button"
import { routes } from "@/lib/site"
import type { Producer } from "@/lib/producers"

/**
 * Database producers carry the administered `tagline`; the content file
 * carries `desc` under the same meaning. Both shapes are accepted; only `desc`
 * is rendered for now (see the note at the tagline line below).
 */
type CardProducer = Omit<Producer, "createdAt" | "tagline" | "sortOrder"> & {
  desc?: string
  tagline?: string | null
}

function CardImage({ producer, priority }: { producer: CardProducer; priority: boolean }) {
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-media bg-paper">
      {producer.photoUrl ? (
        <Image
          src={producer.photoUrl}
          alt={producer.name}
          fill
          priority={priority}
          fetchPriority={priority ? "high" : undefined}
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
        />
      ) : (
        <div className="flex h-full items-center justify-center">
          <span className="label text-olive">Fotoğraf hazırlanıyor</span>
        </div>
      )}
    </div>
  )
}

/**
 * One entry in the /ureticiler grid — the same editorial language as
 * components/blog/post-card.tsx and components/shop/product-entry.tsx: the
 * image sits directly on the page, a hairline carries the metadata.
 *
 * The `secki` variant reorders the same markup for /secki — image, one line of
 * copy, product type, then two explicit destinations. It cannot wrap the tile
 * in a link the way the default does, because the two buttons would then be
 * nested inside it, so on that variant only the image is the passive link and
 * the buttons carry the real navigation.
 */
export function ProducerCard({
  producer,
  priority = false,
  variant = "default",
}: {
  producer: CardProducer
  priority?: boolean
  variant?: "default" | "secki"
}) {
  if (variant === "secki") {
    return (
      <li className="group flex flex-col">
        <Link
          href={routes.producer(producer.slug)}
          prefetch={false}
          tabIndex={-1}
          aria-hidden="true"
          className="block"
        >
          <CardImage producer={producer} priority={priority} />
        </Link>

        <div className="mt-5 flex flex-1 flex-col border-t border-ink/10 pt-4">
          <h2 className="text-xl leading-snug tracking-tight">{producer.name}</h2>
          {/* The content file's desc only. Database rows carry an administered
              tagline, but /ureticiler has never shown one and showing it
              would change that page; see the maturity-pass recommendations. */}
          {producer.desc && (
            <p className="mt-2 text-sm leading-relaxed text-ink/60">{producer.desc}</p>
          )}
          {producer.productType && (
            <p className="label mt-3 text-olive">{producer.productType}</p>
          )}

          {/* One dominant action per card: this page introduces people, so
              the story leads and the shop follows as a quiet text link. */}
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
            <ButtonLink
              href={routes.producer(producer.slug)}
              prefetch={false}
              variant="outline"
              size="sm"
            >
              Hikâyeyi Gör
              <span className="sr-only"> — {producer.name}</span>
            </ButtonLink>
            <Link
              href={routes.producerStore(producer.slug)}
              prefetch={false}
              className="group/shop inline-flex min-h-11 items-center gap-2 text-sm text-ink/60 transition-colors duration-300 hover:text-ink"
            >
              Mağazada Gör
              <span className="sr-only"> — {producer.name}</span>
              <span
                aria-hidden="true"
                className="transition-transform duration-300 group-hover/shop:translate-x-1"
              >
                →
              </span>
            </Link>
          </div>
        </div>
      </li>
    )
  }

  return (
    <li className="group">
      <Link href={routes.producer(producer.slug)} prefetch={false} className="block">
        <CardImage producer={producer} priority={priority} />

        <div className="mt-5 border-t border-ink/10 pt-4">
          {producer.productType && <p className="label text-olive">{producer.productType}</p>}
          <h2 className="mt-2 text-xl leading-snug tracking-tight transition-colors duration-300 group-hover:text-brand">
            {producer.name}
          </h2>
          {producer.region && <p className="mt-2 text-sm leading-relaxed text-ink/60">{producer.region}</p>}
        </div>
      </Link>
    </li>
  )
}
