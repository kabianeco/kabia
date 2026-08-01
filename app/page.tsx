import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { IntroSequence } from "@/components/home/intro-sequence";
import { BrandManifesto } from "@/components/home/brand-manifesto";
import { ProductCollection } from "@/components/home/product-collection";
import { OriginStory } from "@/components/home/origin-story";
import { ProcessStory } from "@/components/home/process-story";
import { Principles } from "@/components/home/principles";
import { EditorialImage } from "@/components/home/editorial-image";
import { BrandQuote } from "@/components/home/brand-quote";
import { FinalCta } from "@/components/home/final-cta";

/**
 * The homepage composes its own shell rather than using PageShell: the intro
 * sequence owns the viewport on load and drives the header out of frame, so
 * `main` here is deliberately not the shared padded one.
 *
 * Motion configuration lives in the root Providers, not here.
 */
export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <IntroSequence />
        <BrandManifesto />
        <ProductCollection />
        <OriginStory />
        <ProcessStory />
        <Principles />
        <EditorialImage />
        <BrandQuote />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
