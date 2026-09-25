import type { Metadata } from "next";
import { Suspense } from "react";
import dynamic from "next/dynamic";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { IntroSequence } from "@/components/home/intro-sequence";
import { BrandManifesto } from "@/components/home/brand-manifesto";
import { ProductCollection } from "@/components/home/product-collection";
import { BestSellers } from "@/components/home/best-sellers";
import { CertStrip } from "@/components/home/cert-strip";
import { HomeFaq } from "@/components/home/home-faq";
import { HarvestNotify } from "@/components/home/harvest-notify";
import { Producers } from "@/components/home/producers";
import { OriginStory } from "@/components/home/origin-story";
import { Principles } from "@/components/home/principles";
import { Emanet } from "@/components/home/emanet";
import { BrandQuote } from "@/components/home/brand-quote";
import { FinalCta } from "@/components/home/final-cta";
import { getPublicSettings } from "@/lib/settings";
import { pageMetadata } from "@/lib/seo";

/** The homepage carries the administered default title and description as-is. */
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicSettings();
  return pageMetadata({
    title: settings.seoDefaultTitle,
    absoluteTitle: true,
    description: settings.seoDefaultDescription,
    path: "/",
  });
}

// Only client-heavy below-fold sections are code-split to avoid
// pushing their framer-motion JS into the LCP bundle.
// Server components stay statically imported for SEO/SSR.
const ProcessStory = dynamic(
  () => import("@/components/home/process-story").then((m) => m.ProcessStory),
  { ssr: true },
);
const EditorialImage = dynamic(
  () => import("@/components/home/editorial-image").then((m) => m.EditorialImage),
  { ssr: true },
);

/**
 * The homepage composes its own shell rather than using PageShell: the intro
 * sequence owns the viewport on load and drives the header out of frame, so
 * `main` here is deliberately not the shared padded one.
 *
 * Order is atmosphere → discovery → storytelling: the intro lands the
 * feeling, the collection answers "what does Kabia sell?" immediately
 * after, and only then does the page settle into manifesto, origin and
 * process. Motion configuration lives in the root Providers, not here.
 */
export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <IntroSequence />
        <OriginStory />
        <Emanet />
        <Suspense
          fallback={
            <section className="border-y border-ink/10 bg-paper">
              <div className="wrap py-24 md:py-32">
                <div className="h-64 motion-safe:animate-pulse bg-paper" aria-hidden="true" />
              </div>
            </section>
          }
        >
          <ProductCollection />
        </Suspense>
        <BrandManifesto />
        <Producers />
        <ProcessStory />
        <Principles />
        <EditorialImage />
        <BrandQuote />
        <BestSellers />
        <CertStrip />
        <HomeFaq />
        <FinalCta />
        <HarvestNotify />
      </main>
      <SiteFooter />
    </>
  );
}
