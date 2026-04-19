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
  status: string;
  payment_status: string;
  subtotal: number;
  total_amount: number;
  voucher_code: string | null;
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

export type TestimonialPlatform =
  | 'tiktok'
  | 'zalo'
  | 'instagram'
  | 'other';

export interface Testimonial {
  id: number;
  image_url: string;
  platform: TestimonialPlatform;
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

export interface Product {
  id: number;
  name: string;
  description: string | null;
  price: number;
  images: string[];
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
  is_featured_on_home: boolean;
  home_sort_order: number;
  created_at: string;
}

