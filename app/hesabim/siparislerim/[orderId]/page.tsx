import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import OrderDetailClient from "./detail-client";

/**
 * S22: unknown or foreign order ids return a real 404.
 *
 * The existence check runs on the server, owner-scoped (order_number +
 * user_id, so RLS agrees); notFound() renders the sibling not-found.tsx
 * with a 404 status instead of the old inline 200. The interactive detail
 * below is byte-identical — it re-reads the full row client-side.
 */
export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Signed-out requests never reach here (the layout redirects first); the
  // 404 below keeps the failure closed rather than rendering a soft error.
  if (!user) notFound();
  const { data } = await supabase
    .from("orders")
    .select("id")
    .eq("order_number", orderId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) notFound();
  return <OrderDetailClient />;
}
