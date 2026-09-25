"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { ALL_FONT_VARIABLES } from "@/lib/fonts";
import { routes } from "@/lib/site";
import "./globals.css";

/**
 * Last-resort boundary for a failure in the root layout itself, where
 * app/error.tsx cannot help because the layout it renders inside is what
 * failed. It replaces the whole document, so it brings its own <html> and
 * <body> and the site's fonts and stylesheet, and repeats error.tsx's copy
 * and markup so the visitor sees the same page either way.
 *
 * The underlying error is logged, never shown.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="tr" className={`${ALL_FONT_VARIABLES} h-full`}>
      <body className="min-h-full flex flex-col">
        <main className="wrap page-top flex min-h-[70vh] flex-col items-start pb-24">
          <p className="label text-clay">Bir sorun oluştu</p>
          <h1 className="mt-6 max-w-2xl text-4xl leading-[1.08] tracking-tight md:text-5xl">
            Sayfa <em className="font-serif italic text-brand">yüklenemedi</em>.
          </h1>
          <p className="mt-7 max-w-md text-base leading-relaxed text-ink/65">
            Bağlantınızı kontrol edip tekrar deneyin. Sorun sürerse birazdan yeniden
            deneyebilirsiniz.
          </p>
          {error.digest && (
            <p className="label mt-6 text-olive">Hata kodu: {error.digest}</p>
          )}
          <div className="mt-10 flex flex-wrap items-center gap-7">
            <Button onClick={reset}>Tekrar dene</Button>
            <ButtonLink href={routes.home} variant="ghost">
              Anasayfa
            </ButtonLink>
          </div>
        </main>
      </body>
    </html>
  );
}
