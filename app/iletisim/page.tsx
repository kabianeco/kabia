import type { Metadata } from "next"
import { pageMetadata } from "@/lib/seo"
import { PageShell } from "@/components/layout/page-shell"
import { ContactForm } from "@/components/contact/contact-form"
import { site, whatsappHref } from "@/lib/site"

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "İletişim",
    description:
      "Kabia Ekolojik'e ulaşın: Geyve'deki bahçemizin adresi, telefon, e-posta ve doğrudan bize yazabileceğiniz form.",
    path: "/iletisim",
  })
}

/** Opens the address in whichever map app the visitor's device prefers. */
const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  `${site.address} ${site.name}`,
)}`

/**
 * The contact page.
 *
 * The form is the point, but it is not the only way through — some people want
 * to write, some want to call, and some want to know where the bahçe actually
 * is before they do either. So the three sit side by side rather than the page
 * funnelling everyone into one box: the details column stands on its own if the
 * form ever fails, which is exactly what the action's fallback message tells
 * the visitor to fall back to.
 */
export default async function ContactPage() {
  return (
    <PageShell>
      <section aria-labelledby="contact-heading">
        <div className="wrap page-top pb-16 md:pb-20">
          <div className="max-w-2xl">
            <p className="label text-olive">İletişim</p>
            <h1
              id="contact-heading"
              className="mt-6 text-4xl leading-[1.08] tracking-tight md:text-6xl"
            >
              Sizi{" "}
              <em className="font-theme-display italic text-brand">dinliyoruz.</em>
            </h1>
            <p className="mt-7 text-base leading-relaxed text-ink/65">
              Siparişiniz, ürünlerimiz ya da birlikte üretmek hakkında ne
              sormak isterseniz — bahçeden biri okuyor ve dönüyor.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="contact-form-heading" className="border-t border-ink/10">
        <div className="wrap py-16 md:py-24">
          <div className="grid gap-14 md:grid-cols-12 md:gap-16">
            {/* Details first in the source as well as on the page: it is the
                part that works with no JavaScript and no database. */}
            <div className="md:col-span-4">
              <h2 className="label text-olive">Bize ulaşın</h2>

              <dl className="mt-8 space-y-8">
                <div>
                  <dt className="text-sm text-ink/50">Bahçe</dt>
                  <dd className="mt-2 text-base leading-relaxed">
                    {site.address}
                    <br />
                    <a
                      href={mapsHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group mt-2 inline-block text-sm text-olive transition-colors duration-300 hover:text-ink"
                    >
                      Yol tarifi al
                      <span
                        aria-hidden="true"
                        className="ml-2 inline-block transition-transform duration-300 group-hover:translate-x-1"
                      >
                        →
                      </span>
                    </a>
                  </dd>
                </div>

                <div>
                  <dt className="text-sm text-ink/50">Telefon</dt>
                  <dd className="mt-2 text-base">
                    <a
                      href={site.phoneHref}
                      className="transition-colors duration-300 hover:text-olive"
                    >
                      {site.phone}
                    </a>
                  </dd>
                </div>

                <div>
                  <dt className="text-sm text-ink/50">WhatsApp</dt>
                  <dd className="mt-2 text-base">
                    <a
                      href={whatsappHref()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group transition-colors duration-300 hover:text-olive"
                    >
                      WhatsApp’tan yazın
                      <span
                        aria-hidden="true"
                        className="ml-2 inline-block transition-transform duration-300 group-hover:translate-x-1"
                      >
                        →
                      </span>
                    </a>
                    <p className="mt-2 text-sm text-ink/50">
                      Hafta içi 09:00–18:00 içinde dönüyoruz.
                    </p>
                  </dd>
                </div>

                <div>
                  <dt className="text-sm text-ink/50">E-posta</dt>
                  <dd className="mt-2 text-base">
                    <a
                      href={`mailto:${site.email}`}
                      className="transition-colors duration-300 hover:text-olive"
                    >
                      {site.email}
                    </a>
                  </dd>
                </div>
              </dl>
            </div>

            <div className="md:col-span-7 md:col-start-6">
              <h2 id="contact-form-heading" className="label text-olive">
                Mesaj bırakın
              </h2>
              <p className="mt-6 max-w-lg text-base leading-relaxed text-ink/65">
                Formu doldurun, size aynı adresten dönelim. Hasat ve paketleme
                günlerinde dönüş bir gün gecikebiliyor — acele bir konuysa
                WhatsApp daha hızlı.
              </p>
              <div className="mt-10">
                <ContactForm />
              </div>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  )
}
