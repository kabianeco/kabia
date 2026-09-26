import type React from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { AccountGuard } from "@/components/account/account-guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { routes } from "@/lib/site";

/**
 * The account area is private: never indexed, whatever robots.txt says (a
 * disallow alone does not remove a URL from the index), and titled as itself
 * rather than inheriting the homepage's title.
 */
export const metadata: Metadata = {
  title: "Hesabım",
  robots: { index: false, follow: false },
};

/**
 * Chrome for the account area. Stays a server component so the footer's
 * settings read happens once per request.
 *
 * S21: the signed-out redirect happens here on the server, producing the
 * same result as the client guard (login with the same `next` parameter).
 * AccountGuard stays as the hydration fallback for client navigations; RLS
 * remains the final boundary underneath.
 */
export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const pathname = (await headers()).get("x-pathname") ?? routes.account;
    redirect(`${routes.login}?next=${encodeURIComponent(pathname)}`);
  }
  return (
    <>
      <SiteHeader />
      <main id="icerik" tabIndex={-1} className="flex-1">
        <AccountGuard>{children}</AccountGuard>
      </main>
      <SiteFooter />
    </>
  );
}
