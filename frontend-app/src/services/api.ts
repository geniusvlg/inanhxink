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
  const url = qrName ? `/api/upload?qrName=${encodeURIComponent(qrName)}` : '/api/upload';
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

export interface Product {
  id: number;
  name: string;
  description: string | null;
  price: number;
  images: string[];
  type: 'thiep' | 'khung_anh' | 'so_scrapbook' | 'khac' | 'set-qua-tang' | 'in_anh';
  categories: { id: number; name: string }[];
  is_active: boolean;
  is_best_seller: boolean;
  tiktok_url: string | null;
  instagram_url: string | null;
  discount_price: number | null;
  discount_from: string | null;
  discount_to: string | null;
  created_at: string;
}

export interface ProductFilters {
  type?: 'thiep' | 'khung_anh' | 'so_scrapbook' | 'khac' | 'set-qua-tang' | 'in_anh';
  category_ids?: string; // comma-separated ids, e.g. "1,2,3"
  min_price?: number;
  max_price?: number;
  sort?: 'newest' | 'price_asc' | 'price_desc';
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

/** Products that admins have flagged as featured-on-home, in their manual sort order. */
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

// Testimonials (customer review screenshots)
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

// Paginated fetch for the public /danh-gia masonry. Page size is admin-tunable
// via the `testimonials_page_size` metadata key (exposed through useFeatureFlags).
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

// Homepage banners (admin-managed hero slides)
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

export default api;

