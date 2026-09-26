import Link from "next/link";
import { routes } from "@/lib/site";

/**
 * S22: the real 404 for unknown or foreign order ids. Copy is byte-identical
 * to the old inline "not found" state so the visible result does not change —
 * only the HTTP status does (200 → 404).
 */
export default function OrderNotFound() {
  return (
    <div>
      <h1 className="text-3xl tracking-tight md:text-4xl">
        Sipariş bulunamadı
      </h1>
      <p className="mt-6 max-w-sm text-base leading-relaxed text-ink/60">
        Bu sipariş numarası hesabınıza ait değil ya da kaldırılmış olabilir.
      </p>
      <Link
        href={routes.accountOrders}
        className="mt-8 inline-flex min-h-11 items-center text-sm text-brand transition-colors hover:text-forest"
      >
        ← Siparişlerime dön
      </Link>
    </div>
  );
}
