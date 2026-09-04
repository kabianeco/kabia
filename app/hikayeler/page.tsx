import { redirect } from "next/navigation";

export const metadata = { title: "Hikâyeler — Kabia Ekolojik", description: "Çiftlik hikayeleri, üretici hikayeleri — emanette." };

export default function HikayelerPage() {
 redirect("/emanet");
}
