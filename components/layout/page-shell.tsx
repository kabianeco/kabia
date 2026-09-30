import type { CSSProperties, ReactNode } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { getPublicSettings } from "@/lib/settings";

/**
 * Shell for every route except the homepage, which composes its own so the
 * intro sequence can take over the viewport. Keeping this in one place is what
 * makes the store and account screens feel like the same product as `/`.
 */
export async function PageShell({ children }: { children: ReactNode }) {
  const settings = await getPublicSettings();
  const showAnnouncement =
    settings.announcementEnabled && settings.announcementText.trim() !== "";
  const showClosed = !settings.storeOpen;

  const bannerVisible = showAnnouncement || showClosed;

  return (
    <div
      className="flex min-h-full flex-col"
      style={
        {
          "--header-offset": bannerVisible ? "6.5rem" : "4rem",
          "--header-offset-desktop": bannerVisible ? "7.5rem" : "5rem",
          } as CSSProperties
      }
    >
      {bannerVisible && (
        <StoreNotice
          text={
            showClosed
              ? settings.maintenanceMessage.trim() ||
                "Mağazamız şu anda siparişe kapalı."
              : settings.announcementText
          }
          urgent={showClosed}
        />
      )}
      <SiteHeader bannerOffset={bannerVisible} />
      <main id="icerik" tabIndex={-1} className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

/**
 * Announcement / closure band, driven by the admin content and store settings.
 *
 * Rendered as plain text — never as HTML — so a settings value cannot become a
 * script injection point. The database additionally rejects values containing
 * script-like patterns.
 *
 * The homepage composes its own shell so its intro sequence can own the
 * viewport, and is deliberately excluded.
 */
function StoreNotice({ text, urgent }: { text: string; urgent: boolean }) {
  return (
    // Full bleed under the status bar: the band starts at top: 0 and its
    // own background fills the notch area. The text lives in the fixed
    // 2.5rem row below the inset — never inside the status bar. The header
    // offsets by this exact height (see bannerOffset in site-header.tsx),
    // so the two never overlap and no strip is left between them. z-30
    // parks it beneath the open mobile menu (header's z-40 context), so
    // the menu index — including its close control — is never covered.
    <div
      role={urgent ? "alert" : "status"}
      className={`fixed inset-x-0 top-0 z-30 pt-[var(--safe-top)] ${
        urgent ? "bg-clay text-on-brand" : "bg-forest text-on-brand"
      }`}
    >
      <div className="flex h-10 items-center justify-center px-6 text-center text-sm">
        <span className="truncate">{text}</span>
      </div>
    </div>
  );
}

/** Standard editorial page header: tracked eyebrow over a serif-accented title. */
export function PageHeading({
  eyebrow,
  title,
  lead,
  id = "page-heading",
}: {
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  id?: string;
}) {
  return (
    <div className="wrap page-top pb-10 md:pb-14">
      <p className="label text-olive">{eyebrow}</p>
      <h1
        id={id}
        className="mt-6 max-w-3xl text-4xl leading-[1.08] tracking-tight md:text-6xl"
      >
        {title}
      </h1>
      {lead && (
        <p className="mt-7 max-w-md text-base leading-relaxed text-ink/65">
          {lead}
        </p>
      )}
    </div>
  );
}
