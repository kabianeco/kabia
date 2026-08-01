/**
 * Shapes of the Postgres rows this app reads, as returned by PostgREST.
 *
 * The source project had no generated database types and mapped every response
 * through `any`. These interfaces cover exactly the columns the selects ask
 * for, so the mappers in lib/catalog.ts and the contexts are checked against
 * something real. They are hand-written against the live schema; regenerate or
 * extend them when the schema changes.
 *
 * Numeric columns come back from PostgREST as `number | string` depending on
 * the column type (numeric arrives as a string), so money is typed as such and
 * always passed through `Number()` by the mappers.
 */

export type Numeric = number | string;

export interface CategoryRow {
  slug: string;
}

export interface ProductVariantRow {
  id: string;
  label: string;
  price: Numeric;
  stock_quantity: number | null;
}

export interface ProductImageRow {
  image_url: string;
  sort_order: number | null;
}

export interface NutritionFactsRow {
  calories: string | null;
  protein: string | null;
  carbohydrates: string | null;
  fat: string | null;
  fiber: string | null;
  sodium: string | null;
}

export interface ReviewRow {
  reviewer_name: string | null;
  rating: number;
  review_text: string;
  is_verified_purchase: boolean | null;
  created_at: string;
}

export interface ProductRow {
  id: string;
  slug: string;
  name: string;
  base_price: Numeric;
  original_price: Numeric | null;
  main_image_url: string | null;
  origin: string | null;
  production_method: string | null;
  shelf_life: string | null;
  storage_conditions: string | null;
  certifications: string | null;
  short_description: string | null;
  description: string | null;
  is_active: boolean;
  is_featured: boolean;
  created_at: string;
  rating_avg: Numeric | null;
  rating_count: number | null;
  rating_breakdown: number[] | null;
  category: CategoryRow | null;
  product_variants: ProductVariantRow[] | null;
  product_images: ProductImageRow[] | null;
  nutrition_facts: NutritionFactsRow | null;
  reviews?: ReviewRow[] | null;
}

export interface CartItemRow {
  id: string;
  quantity: number;
  variant_id: string;
  product_id: string;
  product_variants: { label: string; price: Numeric };
  products: { slug: string; name: string; main_image_url: string };
}

export interface AddressRow {
  id: string;
  label: string;
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  district: string;
  postal_code: string;
  is_default: boolean;
}

export interface PaymentMethodRow {
  id: string;
  card_brand: string | null;
  last4: string | null;
  expiry_month: number | string | null;
  expiry_year: number | string | null;
  card_name: string | null;
  is_default: boolean;
}

export interface NotificationPreferencesRow {
  campaign_emails: boolean | null;
  order_status: boolean | null;
  sms: boolean | null;
  stock_alerts: boolean | null;
}

export interface OrderItemRow {
  product_slug_snapshot: string;
  product_name_snapshot: string;
  variant_label_snapshot: string;
  unit_price_snapshot: Numeric;
  quantity: number;
  product_image_snapshot: string;
  variant_id: string | null;
  product_id: string | null;
}

export interface OrderRow {
  order_number: string;
  created_at: string;
  status: string;
  subtotal: Numeric;
  shipping_cost: Numeric;
  total: Numeric;
  full_name: string;
  email: string;
  shipping_address: {
    label: string;
    recipientName: string;
    phone: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    district: string;
    postalCode: string;
  } | null;
  payment_method_snapshot: { label?: string } | null;
  order_items: OrderItemRow[] | null;
}

export interface FavoriteRow {
  product_id: string;
  products: { slug: string } | null;
}
