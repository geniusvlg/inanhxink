export interface Template {
  id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  template_type: string;
  is_active: boolean;
  demo_url: string | null;
  created_at: string;
}

export interface Order {
  id: number;
  qr_name: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  template_id: number;
  template_name?: string;
  template_type: string;
  payment_status: string;
  keychain_delivery_status: string | null;
  keychain_purchased: boolean;
  keychain_price: number;
  subtotal: number;
  total_amount: number;
  voucher_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductOrderItem {
  product_id: number;
  product_name: string;
  variant_id?: number | null;
  variant_name?: string | null;
  quantity: number;
  unit_price: number;
  /** First product gallery image or variant image (same as storefront); set when order is created. */
  catalog_image?: string | null;
  image_urls: string[];
  note: string;
}

export interface ProductOrder {
  id: number;
  cart_session_id: string;
  invoice_number: string | null;
  payment_status: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  customer_address: string;
  items: ProductOrderItem[];
  subtotal: number;
  shipping_fee: number;
  total_amount: number;
  created_at: string;
  updated_at: string;
}

export interface Voucher {
  id: number;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ProductCategory {
  id: number;
  name: string;
  type: string;
}

export interface Testimonial {
  id: number;
  image_url: string;
  reviewer_name: string | null;
  caption: string | null;
  is_featured: boolean;
  is_featured_on_home: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Banner {
  id: number;
  image_url: string;
  link_url: string | null;
  alt_text: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** A single hero polaroid slot (0, 1, or 2). Image and caption are
 *  individually optional so admins can leave a slot blank during setup. */
export interface HeroShot {
  slot: 0 | 1 | 2;
  image_url: string | null;
  caption:   string | null;
  updated_at: string;
}

export interface ProductVariant {
  id?: number;
  product_id?: number;
  name: string;
  price: number;
  discount_price?: number | null;
  discount_from?: string | null;
  discount_to?: string | null;
  image: string | null;
  sort_order: number;
}

export interface Product {
  id: number;
  name: string;
  description: string | null;
  price: number;
  images: string[];
  thumbnail_url: string | null;
  type: 'thiep' | 'khung_anh' | 'so_scrapbook' | 'khac' | 'set-qua-tang' | 'in_anh';
  categories: { id: number; name: string }[];
  category_ids?: number[];
  is_active: boolean;
  is_best_seller: boolean;
  watermark_enabled: boolean;
  tiktok_url: string | null;
  instagram_url: string | null;
  discount_price: number | null;
  discount_from: string | null;
  discount_to: string | null;
  max_upload_images: number;
  /** Đã bán — increments on payment; admin can adjust. */
  sold_count?: number;
  average_rating?: number | null;
  review_count?: number;
  is_featured_on_home: boolean;
  home_sort_order: number;
  created_at: string;
  variants?: ProductVariant[];
}

/** Product review row (admin list includes `is_admin_entry`). */
export interface AdminProductReview {
  id: number;
  rating: number;
  comment: string;
  created_at: string;
  customer_name: string;
  invoice_number: string;
  ordered_product_label: string;
  variant_name?: string | null;
  variant_id?: number | null;
  is_admin_entry?: boolean;
}

