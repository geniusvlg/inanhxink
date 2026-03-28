export interface Template {
  id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  template_type: string;
  is_active: boolean;
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
}

export interface Product {
  id: number;
  name: string;
  description: string | null;
  price: number;
  images: string[];
  type: 'thiep' | 'khung_anh' | 'so_scrapbook';
  categories: { id: number; name: string }[];
  category_ids?: number[];
  is_active: boolean;
  created_at: string;
}

