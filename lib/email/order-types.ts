/**
 * Group B · shared order shape.
 *
 * Field names follow the `orders` / `order_items` rows the `create_order` RPC
 * writes: snapshots for names, numeric totals, and the camelCase
 * `shipping_address` jsonb this app already reads (`lib/supabase/rows.ts`).
 */
import { escapeHtml } from "./layout";

export interface OrderItemInput {
  /** `product_name_snapshot` */
  name: string;
  /** `variant_label_snapshot` */
  variant: string;
  quantity: number;
  /** `unit_price_snapshot` */
  unitPrice: number;
}

export interface OrderAddressInput {
  fullName: string;
  line1: string;
  line2?: string;
  district: string;
  city: string;
  postalCode: string;
}

export interface OrderSummaryInput {
  /** `KB-XXXXXXX` from the `create_order` RPC. */
  orderNumber: string;
  items: OrderItemInput[];
  subtotal: number;
  shippingCost: number;
  total: number;
  address: OrderAddressInput;
}

/** One-line delivery address summary, escaped. */
export function addressLines(address: OrderAddressInput): string[] {
  const lines = [address.fullName, address.line1];
  if ((address.line2 ?? "").trim() !== "") lines.push(address.line2!.trim());
  lines.push(`${address.district} / ${address.city} ${address.postalCode}`);
  return lines.map(escapeHtml);
}
