"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { routes } from "@/lib/site";

/**
 * Route-level error boundary. The underlying error is logged for the operator
 * and never shown to the visitor — server and database messages stay internal.
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
    <div className="wrap page-top flex min-h-[70vh] flex-col items-start pb-24">
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
    </div>
  );
}
