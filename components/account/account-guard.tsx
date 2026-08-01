"use client";

import type React from "react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AccountNav } from "@/components/account/account-nav";
import { useAuth } from "@/lib/auth-context";
import { routes } from "@/lib/site";

/**
 * Client guard for the account area. The Supabase session lives in a cookie
 * that the browser client reads on mount, so the redirect waits for auth to
 * hydrate; every query underneath is additionally protected by RLS, which is
 * what actually enforces access.
 *
 * Only the guard is a client component. The surrounding chrome stays on the
 * server, because pulling an async server component such as the footer across
 * this boundary would make it run in the browser, where React retries it on
 * every render instead of awaiting it once.
 */
export function AccountGuard({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, hydrated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (hydrated && !isLoggedIn) {
      router.replace(`${routes.login}?next=${encodeURIComponent(pathname)}`);
    }
  }, [hydrated, isLoggedIn, router, pathname]);

  if (!hydrated || !isLoggedIn) {
    return (
      <div className="min-h-[60vh]" aria-busy="true">
        <span className="sr-only">Hesabınız yükleniyor</span>
      </div>
    );
  }

  return (
    <div className="wrap page-top pb-24 md:pb-32">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-3">
          <AccountNav />
        </div>
        <div className="min-w-0 lg:col-span-8 lg:col-start-5">{children}</div>
      </div>
    </div>
  );
}
