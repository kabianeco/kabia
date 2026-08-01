import type React from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { AccountGuard } from "@/components/account/account-guard";

/**
 * Chrome for the account area. Stays a server component so the footer's
 * settings read happens once per request; the session check that decides
 * whether the page renders at all lives in AccountGuard.
 */
export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <AccountGuard>{children}</AccountGuard>
      </main>
      <SiteFooter />
    </>
  );
}
