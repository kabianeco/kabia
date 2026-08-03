import Image from "next/image";
import type { ReactNode } from "react";

/**
 * Shared frame for the sign-in and sign-up screens: a full-bleed orchard plate
 * on one side, the form on the other. Same measure, type and hairlines as the
 * rest of the site — no boxed card.
 */
export function AuthShell({
  eyebrow,
  title,
  lead,
  image,
  imageCaption,
  children,
  footer,
}: {
  eyebrow: string;
  title: ReactNode;
  lead?: string;
  image: string;
  imageCaption: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="wrap page-top pb-24 md:pb-32">
      <div className="grid gap-14 lg:grid-cols-12 lg:gap-20">
        <div className="lg:col-span-5">
          <p className="label text-olive">{eyebrow}</p>
          <h1 className="mt-6 text-4xl leading-[1.08] tracking-tight md:text-5xl">
            {title}
          </h1>
          {lead && (
            <p className="mt-6 max-w-sm text-base leading-relaxed text-ink/65">
              {lead}
            </p>
          )}
          <div className="mt-12">{children}</div>
          {footer && <div className="mt-10">{footer}</div>}
        </div>

        <div className="hidden lg:col-span-6 lg:col-start-7 lg:block">
          <figure className="relative aspect-[4/5] overflow-hidden rounded-media">
            <Image
              src={image}
              alt=""
              fill
              priority
              sizes="50vw"
              className="object-cover"
            />
            <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-forest/85 to-transparent p-8">
              <p className="max-w-xs font-theme-display text-xl italic leading-snug text-on-brand">
                {imageCaption}
              </p>
            </figcaption>
          </figure>
        </div>
      </div>
    </div>
  );
}
