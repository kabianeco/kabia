import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";
import { ButtonLink } from "@/components/ui/button";
import { routes } from "@/lib/site";

export const metadata: Metadata = {
  title: "Sayfa bulunamadı",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <PageShell>
      <div className="wrap page-top flex min-h-[55vh] flex-col items-start pb-24">
        <p className="label text-olive">404</p>
        <h1 className="mt-6 max-w-2xl text-4xl leading-[1.08] tracking-tight md:text-6xl">
          Bu sayfa <em className="font-serif italic text-brand">yok</em>.
        </h1>
        <p className="mt-7 max-w-md text-base leading-relaxed text-ink/65">
          Aradığınız sayfa taşınmış ya da hiç var olmamış olabilir. Mağazadan
          devam edebilirsiniz.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-7">
          <ButtonLink href={routes.store}>Mağazaya git</ButtonLink>
          <ButtonLink href={routes.home} variant="ghost">
            Anasayfa
          </ButtonLink>
        </div>
      </div>
    </PageShell>
  );
}
