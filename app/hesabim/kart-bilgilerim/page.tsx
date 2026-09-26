import { AccountHeading } from "@/components/account/account-states";
import { ArrowLink } from "@/components/ui/button";
import { routes } from "@/lib/site";

/**
 * Old "Kartlarım" address, kept so bookmarks and e-mails still land somewhere
 * honest. Card saving is retired: the site never stored anything a payment
 * could be made with, so it no longer asks for card numbers or CVV here.
 */
export default function SavedCardsRetiredPage() {
  return (
    <div className="max-w-xl">
      <AccountHeading title="Kayıtlı kartlar" />
      <p className="mt-8 text-base leading-relaxed text-ink/60">
        Kart kaydetme özelliğini kaldırdık. Kart bilgilerinizi hesabınızda saklamıyoruz; ödeme
        bilgilerini yalnızca sipariş sırasında girersiniz.
      </p>
      <div className="mt-8">
        <ArrowLink href={routes.accountOrders}>Siparişlerime git</ArrowLink>
      </div>
    </div>
  );
}
