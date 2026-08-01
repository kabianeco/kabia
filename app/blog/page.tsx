import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";
import { ArrowLink } from "@/components/ui/button";
import { mailto, routes } from "@/lib/site";

export const metadata: Metadata = {
  title: "Günlük",
  description:
    "Kabia'nın bahçe günlüğü: hasat takvimi, üretim notları ve mevsim yazıları hazırlanıyor.",
  alternates: { canonical: "/blog" },
};

/**
 * Kept because the URL is already published. There is no post archive behind it
 * yet, so the page says exactly that rather than showing invented articles.
 */
export default function BlogPage() {
  return (
    <PageShell>
      <div className="wrap page-top flex min-h-[55vh] flex-col items-start pb-24 md:pb-32">
        <p className="label text-olive">Günlük</p>
        <h1 className="mt-6 max-w-2xl text-4xl leading-[1.08] tracking-tight md:text-6xl">
          Bahçe günlüğü{" "}
          <em className="font-serif italic text-brand">hazırlanıyor</em>.
        </h1>
        <p className="mt-7 max-w-md text-base leading-relaxed text-ink/65">
          Hasat takvimi, üretim notları ve mevsim yazıları burada toplanacak. Bu
          arada ürünlere mağazadan bakabilir, sorularınızı bize yazabilirsiniz.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-8">
          <ArrowLink href={routes.store}>Mağaza</ArrowLink>
          <a
            href={mailto("Kabia — bilgi")}
            className="min-h-11 text-sm text-ink/60 transition-colors duration-300 hover:text-ink"
          >
            Bize yazın
          </a>
        </div>
      </div>
    </PageShell>
  );
}
