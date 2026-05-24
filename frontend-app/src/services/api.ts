import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const healthCheck = async () => {
  const response = await api.get('/api/health');
  return response.data;
};

export const testDatabase = async () => {
  const response = await api.get('/api/test-db');
  return response.data;
};

// Templates
export const getTemplates = async () => {
  const response = await api.get('/api/templates');
  return response.data;
};

export const getTemplate = async (id: string) => {
  const response = await api.get(`/api/templates/${id}`);
  return response.data;
};

// Orders
export const checkQrName = async (qrName: string) => {
  const response = await api.post('/api/orders/check-qr-name', { qrName });
  return response.data;
};

export const createOrder = async (orderData: unknown) => {
  const response = await api.post('/api/orders', orderData);
  return response.data;
};

export const getOrder = async (id: string) => {
  const response = await api.get(`/api/orders/${id}`);
  return response.data;
};

// Vouchers
export const validateVoucher = async (code: string) => {
  const response = await api.post('/api/vouchers/validate', { code });
  return response.data;
};

// QR Codes
export const getQrCodeByName = async (qrName: string) => {
  const response = await api.get(`/api/qrcodes/${qrName}`);
  return response.data;
};

// File upload
export const uploadFiles = async (files: File[], qrName?: string): Promise<string[]> => {
  const formData = new FormData();
  files.forEach((f) => formData.append('files', f));
  const url = qrName ? `/api/upload?prefix=${encodeURIComponent('uploads/temp/' + qrName)}` : '/api/upload';
  const response = await api.post(url, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.urls as string[];
};

// Music extraction
export const extractMusic = async (url: string, qrName?: string): Promise<string> => {
  const response = await api.post('/api/music/extract', { url, qrName });
  return response.data.url as string;
};

// Metadata / config
export const getMetadata = async (): Promise<Record<string, string>> => {
  const response = await api.get('/api/metadata');
  return response.data.config as Record<string, string>;
};

// Payments
export const createPayment = async (orderId: number) => {
  const response = await api.post('/api/payments', { orderId });
  return response.data;
};

export const getPaymentStatus = async (orderId: number) => {
  const response = await api.get(`/api/payments/order/${orderId}`);
  return response.data;
};

export const getPaymentByQrName = async (qrName: string) => {
  const response = await api.get(`/api/payments/qr/${qrName}`);
  return response.data;
};

export interface ProductVariant {
  id: number;
  name: string;
  price: number;
  discount_price: number | null;
  discount_from: string | null;
  discount_to: string | null;
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
  is_active: boolean;
  is_best_seller: boolean;
  tiktok_url: string | null;
  instagram_url: string | null;
  discount_price: number | null;
  discount_from: string | null;
  discount_to: string | null;
  max_upload_images: number;
  /** Total units sold (auto + admin). */
  sold_count?: number;
  /** Rolling average from verified purchase reviews; null when there are no reviews. */
  average_rating?: number | null;
  review_count?: number;
  created_at: string;
  variants?: ProductVariant[];
}

export interface ProductReview {
  id: number;
  rating: number;
  comment: string;
  created_at: string;
  customer_name: string;
  invoice_number: string;
  /** Variant label from order JSON or resolved server-side from `variant_id`. */
  variant_name?: string | null;
  /** Order line variant id when JSON omitted `variant_name` (client omitempty). */
  variant_id?: number | null;
}

export interface ProductReviewsPage {
  reviews: ProductReview[];
  total: number;
  page: number;
  limit: number;
}

export interface ProductFilters {
  type?: 'thiep' | 'khung_anh' | 'so_scrapbook' | 'khac' | 'set-qua-tang' | 'in_anh';
  category_ids?: string; // comma-separated ids, e.g. "1,2,3"
  min_price?: number;
  max_price?: number;
  sort?: 'newest' | 'price_asc' | 'price_desc';
  /** Title-only search (backend `q`). */
  q?: string;
  page?: number;
  limit?: number;
}

export interface ProductsPage {
  products: Product[];
  total: number;
  page: number;
  limit: number;
}

export const getProducts = async (filters: ProductFilters = {}): Promise<ProductsPage> => {
  const params: Record<string, string | number> = {};
  if (filters.type)         params.type         = filters.type;
  if (filters.category_ids) params.category_ids = filters.category_ids;
  if (filters.min_price != null && filters.min_price !== 0) params.min_price = filters.min_price;
  if (filters.max_price != null) params.max_price = filters.max_price;
  if (filters.sort && filters.sort !== 'newest') params.sort = filters.sort;
  if (filters.q?.trim()) params.q = filters.q.trim();
  if (filters.page  != null) params.page  = filters.page;
  if (filters.limit != null) params.limit = filters.limit;
  const response = await api.get<{ success: boolean } & ProductsPage>('/api/products', { params });
  return {
    products:  response.data.products ?? [],
    total:     response.data.total    ?? 0,
    page:      response.data.page     ?? 1,
    limit:     response.data.limit    ?? 12,
  };
};

export const getProductById = async (id: number): Promise<Product> => {
  const response = await api.get<{ success: boolean; product: Product }>(`/api/products/${id}`);
  return response.data.product;
};

export const getProductReviews = async (
  productId: number,
  opts: { page?: number; limit?: number } = {},
): Promise<ProductReviewsPage> => {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 10;
  const response = await api.get<{ success: boolean } & ProductReviewsPage>(
    `/api/products/${productId}/reviews`,
    { params: { page, limit } },
  );
  return {
    reviews: response.data.reviews ?? [],
    total: response.data.total ?? 0,
    page: response.data.page ?? page,
    limit: response.data.limit ?? limit,
  };
};

export const createProductReview = async (
  productId: number,
  body: { invoice_number: string; rating: number; comment: string },
): Promise<void> => {
  try {
    await api.post(`/api/products/${productId}/reviews`, body);
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.data && typeof (e.response.data as { error?: unknown }).error === 'string') {
      throw new Error((e.response.data as { error: string }).error);
    }
    throw e instanceof Error ? e : new Error('Không gửi được đánh giá');
  }
};

export const getFeaturedProducts = async (): Promise<Product[]> => {
  const response = await api.get<{ success: boolean; products: Product[] }>(
    '/api/products/featured-on-home',
  );
  return response.data.products ?? [];
};

export const getCategories = async (type?: string): Promise<{ id: number; name: string }[]> => {
  const params = type ? { type } : {};
  const response = await api.get<{ success: boolean; categories: { id: number; name: string }[] }>('/api/categories', { params });
  return response.data.categories ?? [];
};

export interface Testimonial {
  id: number;
  image_url: string;
  reviewer_name: string | null;
  caption: string | null;
  is_featured: boolean;
  is_featured_on_home: boolean;
}

export const getTestimonials = async (): Promise<Testimonial[]> => {
  const response = await api.get<{ success: boolean; testimonials: Testimonial[] }>('/api/testimonials');
  return response.data.testimonials ?? [];
};

export interface TestimonialsPage {
  testimonials: Testimonial[];
  total:        number;
  page:         number;
  page_size:    number;
  total_pages:  number;
}

export const getTestimonialsPaginated = async (
  params: { page: number; page_size?: number },
): Promise<TestimonialsPage> => {
  const response = await api.get<{
    success: boolean;
    testimonials: Testimonial[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
  }>('/api/testimonials', { params });
  return {
    testimonials: response.data.testimonials ?? [],
    total:        response.data.total       ?? 0,
    page:         response.data.page        ?? params.page,
    page_size:    response.data.page_size   ?? params.page_size ?? 12,
    total_pages:  response.data.total_pages ?? 1,
  };
};

export interface Banner {
  id: number;
  image_url: string;
  link_url: string | null;
  alt_text: string | null;
}

export const getBanners = async (): Promise<Banner[]> => {
  const response = await api.get<{ success: boolean; banners: Banner[] }>('/api/banners');
  return response.data.banners ?? [];
};

export interface HeroShot {
  slot: 0 | 1 | 2;
  image_url: string | null;
  caption:   string | null;
}

export const getHeroShots = async (): Promise<HeroShot[]> => {
  const response = await api.get<{ success: boolean; hero_shots: HeroShot[] }>('/api/hero-shots');
  return response.data.hero_shots ?? [];
};


export interface CartItem {
  product_id:   number;
  product_name: string;
  variant_id?:   number | null;
  variant_name?: string | null;
  quantity:     number;
  unit_price:   number;
  image_urls:   string[];
  note:         string;
}

export interface CreateProductOrderPayload {
  cart_session_id:  string;
  customer_name:    string;
  customer_phone:   string;
  customer_email?:  string;
  customer_address: string;
  items:            CartItem[];
}

export interface ProductOrderResult {
  success:      boolean;
  order_id:     number;
  invoice_number?: string;
  shipping_fee?:   number;
  total_amount?:   number;
  already_paid?:   boolean;
}

export const createProductOrder = async (
  payload: CreateProductOrderPayload,
): Promise<ProductOrderResult> => {
  const response = await api.post<ProductOrderResult>('/api/product-orders', payload);
  return response.data;
};

export const getProductOrder = async (id: number) => {
  const response = await api.get(`/api/product-orders/${id}`);
  return response.data;
};

export interface ProductCheckoutFields {
  success:        boolean;
  action_url:     string;
  ordered_fields: { name: string; value: string }[];
}

export const createProductCheckout = async (orderId: number): Promise<ProductCheckoutFields> => {
  const response = await api.post<ProductCheckoutFields>('/api/payments/product-checkout', { orderId });
  return response.data;
};

export interface ProductPaymentResponse {
  success: boolean;
  order: {
    id:            number;
    invoiceNumber: string;
    totalAmount:   number;
    paymentStatus: string;
  };
  payment: {
    qrUrl:       string;
    amount:      number;
    paymentCode: string;
    status:      string;
    accountNo:   string;
    accountName: string;
    bank:        string;
  };
}

export const getProductPayment = async (orderId: number): Promise<ProductPaymentResponse> => {
  const response = await api.get<ProductPaymentResponse>(`/api/payments/product/${orderId}`);
  return response.data;
};

export const uploadProductImages = async (files: File[], sessionId: string): Promise<string[]> => {
  const formData = new FormData();
  files.forEach(f => formData.append('files', f));
  const response = await api.post(
    `/api/upload?prefix=product-orders/temp/${sessionId}`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return response.data.urls as string[];
};

export interface TrackOrderResult {
  success: boolean;
  type: 'product' | 'qr';
  order: {
    invoice_number: string;
    customer_name: string;
    payment_status: string;
    fulfillment_status: string;
    fulfillment_label: string;
    tracking_code: string;
    shipping_carrier: string;
    shipping_fee?: number;
    total_amount: number;
    created_at: string;
    items: CartItem[];
  };
}

export const trackOrder = async (code: string): Promise<TrackOrderResult> => {
  const response = await api.get('/api/orders/track', { params: { code } });
  return response.data as TrackOrderResult;
};

export default api;

