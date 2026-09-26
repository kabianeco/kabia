import type { SupabaseClient } from "@supabase/supabase-js";
import { hasPreviewItems, type PreviewIdentity } from "@/lib/preview-identity";

/** Actual order boundary used by CheckoutFlow. Factory stays lazy until safe. */
export async function submitOrder(items: readonly PreviewIdentity[], createClient: () => Promise<SupabaseClient>, payload: Record<string, unknown>) {
  if (hasPreviewItems(items)) return { status: "preview_blocked" as const };
  const { data, error } = await (await createClient()).rpc("create_order", payload);
  return { status: "ok" as const, data, error };
}
