import Link from "next/link";
import { PageShell } from "@/components/layout/page-shell";
import { legalLinks, site } from "@/lib/site";

export function LegalLayout({
  title,
  eyebrow = "Yasal",
  description,
  updatedAt = "24 Ağustos 2026",
  children,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  updatedAt?: string;
  children: React.ReactNode;
}) {
  return (
    <PageShell>
      <div className="wrap page-top pb-16 md:pb-24">
        <div className="grid gap-10 lg:grid-cols-[1fr_260px] lg:gap-16">
          {/* Main */}
          <article className="min-w-0">
            <p className="label text-olive">{eyebrow}</p>
            <h1 className="mt-4 max-w-2xl text-3xl leading-[1.08] tracking-tight md:text-5xl">
              {title}
            </h1>
            {description && (
              <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-ink/65">
                {description}
              </p>
            )}
            <p className="mt-4 text-xs text-ink/45">Son güncelleme: {updatedAt}</p>

            <div className="mt-10 border-t border-ink/10 pt-10">
              <div className="prose-legal">{children}</div>
            </div>

            <div className="mt-12 rounded-theme-card border border-ink/10 bg-paper p-5 text-sm leading-relaxed text-ink/60">
              <p className="font-medium text-ink">Satıcı bilgileri</p>
              <p className="mt-2">
                <strong className="text-ink">Unvan:</strong> Kabia Ekolojik Tarım Ürünleri · Sakarya Geyve
                <br />
                <strong className="text-ink">Adres:</strong> {site.address}
                <br />
                <strong className="text-ink">E-posta:</strong>{" "}
                <a href={`mailto:${site.email}`} className="text-brand hover:text-forest underline underline-offset-4">
                  {site.email}
                </a>
                <br />
                <strong className="text-ink">Telefon:</strong>{" "}
                <a href={site.phoneHref} className="text-brand hover:text-forest underline underline-offset-4">
                  {site.phone}
                </a>
                <br />
                <strong className="text-ink">MERSİS / KEP / ETBİS:</strong> ETBİS kaydımız için{" "}
                <a
                  href="https://www.eticaret.gov.tr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand hover:text-forest underline underline-offset-4"
                >
                  eticaret.gov.tr
                </a>{" "}
                üzerinden “Kabia Ekolojik” sorgusu yapılabilir. Vergi ve sicil bilgileri fatura üzerinde sunulur.
              </p>
            </div>
          </article>

          {/* Sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-theme-card border border-ink/10 bg-paper p-6">
              <h2 className="label text-olive">Yasal menü</h2>
              <nav aria-label="Yasal sayfalar" className="mt-4 space-y-1">
                {legalLinks.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="block rounded-theme-input px-3 py-2 text-sm text-ink/70 transition-colors hover:bg-ivory hover:text-ink"
                  >
                    {l.label}
                  </Link>
                ))}
              </nav>
              <div className="mt-6 border-t border-ink/10 pt-6">
                <p className="text-xs leading-relaxed text-ink/55">
                  Sorularınız için{" "}
                  <a href={`mailto:${site.email}`} className="text-brand hover:text-forest underline underline-offset-4">
                    {site.email}
                  </a>{" "}
                  veya <a href={site.phoneHref} className="text-brand hover:text-forest underline underline-offset-4">{site.phone}</a> üzerinden bize ulaşabilirsiniz. Hafta içi 09:00–18:00.
                </p>
              </div>
            </div>
          </aside>
        </div>

        {/* Mobile legal nav */}
        <nav aria-label="Yasal sayfalar" className="mt-12 flex flex-wrap gap-2 lg:hidden">
          {legalLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-full border border-ink/10 bg-paper px-4 py-2 text-xs text-ink/70 transition-colors hover:border-brand hover:text-brand"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>

      <style>{`
        .prose-legal {
          font-size: 14.5px;
          line-height: 1.75;
          color: color-mix(in srgb, var(--text) 78%, transparent);
        }
        .prose-legal h2 {
          margin-top: 2.2em;
          margin-bottom: 0.7em;
          font-size: 1.15rem;
          font-weight: 600;
          letter-spacing: -0.015em;
          color: var(--text);
        }
        .prose-legal h3 {
          margin-top: 1.7em;
          margin-bottom: 0.5em;
          font-size: 1rem;
          font-weight: 600;
          color: var(--text);
        }
        .prose-legal p { margin: 0.9em 0; }
        .prose-legal ul, .prose-legal ol {
          margin: 0.9em 0;
          padding-left: 1.35em;
        }
        .prose-legal li { margin: 0.4em 0; }
        .prose-legal li::marker { color: var(--text-muted); }
        .prose-legal a {
          color: var(--brand);
          text-decoration: underline;
          text-underline-offset: 4px;
        }
        .prose-legal a:hover { color: #0b3f2c; }
        .prose-legal strong { color: var(--text); font-weight: 600; }
        .prose-legal table {
          width: 100%;
          margin: 1.2em 0;
          border-collapse: collapse;
          font-size: 13.5px;
        }
        .prose-legal th, .prose-legal td {
          border: 1px solid color-mix(in srgb, var(--text) 12%, transparent);
          padding: 10px 12px;
          text-align: left;
          vertical-align: top;
        }
        .prose-legal th {
          background: var(--surface-raised);
          font-weight: 600;
          color: var(--text);
        }
        .prose-legal blockquote {
          margin: 1.4em 0;
          border-left: 3px solid var(--brand);
          padding: 0.6em 1em;
          background: color-mix(in srgb, var(--surface-raised) 70%, transparent);
          color: var(--text);
          font-size: 13.5px;
        }
        .prose-legal hr {
          margin: 2em 0;
          border: none;
          border-top: 1px solid color-mix(in srgb, var(--text) 10%, transparent);
        }
      `}</style>
    </PageShell>
  );
}
