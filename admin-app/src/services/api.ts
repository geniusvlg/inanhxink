import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401 clear token and redirect to login
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_username');
      window.location.href = '/admin/login';
    }
    return Promise.reject(err);
  }
);

export default api;

export const authApi = {
  login: (username: string, password: string) =>
    api.post<{ success: boolean; token: string; username: string }>('/api/admin/auth/login', { username, password }),
  me: () => api.get('/api/admin/auth/me'),
};

export const templatesApi = {
  list:   ()                      => api.get('/api/admin/templates'),
  get:    (id: number)            => api.get(`/api/admin/templates/${id}`),
  create: (data: unknown)         => api.post('/api/admin/templates', data),
  update: (id: number, data: unknown) => api.put(`/api/admin/templates/${id}`, data),
  delete: (id: number)            => api.delete(`/api/admin/templates/${id}`),
};

export const ordersApi = {
  list: (params?: Record<string, string | number>) => api.get('/api/admin/orders', { params }),
  get:  (id: number)  => api.get(`/api/admin/orders/${id}`),
  updateStatus: (id: number, data: { status?: string; payment_status?: string }) =>
    api.patch(`/api/admin/orders/${id}/status`, data),
};

export const vouchersApi = {
  list:   ()                      => api.get('/api/admin/vouchers'),
  create: (data: unknown)         => api.post('/api/admin/vouchers', data),
  update: (id: number, data: unknown) => api.put(`/api/admin/vouchers/${id}`, data),
  delete: (id: number)            => api.delete(`/api/admin/vouchers/${id}`),
};

export const metadataApi = {
  get:    ()                              => api.get('/api/admin/metadata'),
  update: (data: Record<string, string>) => api.put('/api/admin/metadata', data),
};

export const productsApi = {
  list:      (type: string, page = 1, limit = 20) => api.get('/api/admin/products', { params: { type, page, limit } }),
  checkName: (name: string, type: string) => api.post<{ success: boolean; available: boolean; message?: string }>('/api/admin/products/check-name', { name, type }),
  reserve:   (name: string, type: string) => api.post<{ success: boolean; productId: number }>('/api/admin/products/reserve', { name, type }),
  create:    (data: unknown)             => api.post('/api/admin/products', data),
  update:    (id: number, data: unknown) => api.put(`/api/admin/products/${id}`, data),
  delete:    (id: number)                => api.delete(`/api/admin/products/${id}`),
  // Featured-on-home — admin-curated set displayed on the public /home page.
  listFeaturedOnHome: () => api.get('/api/admin/products/featured-on-home'),
  reorderFeaturedOnHome: (items: { id: number; sort_order: number }[]) =>
    api.patch('/api/admin/products/featured-on-home/reorder', { items }),
};

export const productCategoriesApi = {
  list:   (type?: string) => api.get('/api/admin/product-categories', { params: type ? { type } : {} }),
  create: (data: unknown) => api.post('/api/admin/product-categories', data),
  delete: (id: number)    => api.delete(`/api/admin/product-categories/${id}`),
};

export const uploadApi = {
  images: (files: File[], folder = 'product-new', watermark = false) => {
    const form = new FormData();
    files.forEach(f => form.append('files', f));
    return api.post<{ success: boolean; urls: string[] }>(
      `/api/upload?prefix=products/${folder}&watermark=${watermark}`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  },
  testimonials: (files: File[], watermark = false) => {
    const form = new FormData();
    files.forEach(f => form.append('files', f));
    const url = `/api/upload?prefix=testimonials${watermark ? '&watermark=true' : ''}`;
    return api.post<{ success: boolean; urls: string[] }>(
      url,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  },
  banners: (files: File[]) => {
    const form = new FormData();
    files.forEach(f => form.append('files', f));
    return api.post<{ success: boolean; urls: string[] }>(
      '/api/upload?prefix=banners',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  },
  heroShots: (files: File[]) => {
    const form = new FormData();
    files.forEach(f => form.append('files', f));
    return api.post<{ success: boolean; urls: string[] }>(
      '/api/upload?prefix=hero-shots',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  },
  /** Upload one or more product-page banner slides. Stored under
   *  s3://.../product-banner/. The DB stores raw S3 URLs; the public
   *  /api/metadata route rewrites them to CDN URLs at response time. */
  productBanner: (files: File[]) => {
    const form = new FormData();
    files.forEach(f => form.append('files', f));
    return api.post<{ success: boolean; urls: string[] }>(
      '/api/upload?prefix=product-banner',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  },
  /** Best-effort removal of S3 objects by their public URLs. Used to clean
   *  up orphans from cancelled uploads. Never throws — caller can fire-and-forget. */
  deleteMany: (urls: string[]) =>
    api.delete<{ success: boolean; results: { url: string; deleted: boolean }[] }>(
      '/api/admin/uploads',
      { data: { urls } },
    ).catch(err => {
      console.warn('[uploadApi.deleteMany] failed:', err);
      return null;
    }),
};

export type TestimonialBulkItem = {
  image_url:            string;
  reviewer_name?:       string | null;
  caption?:             string | null;
  is_featured?:         boolean;
  is_featured_on_home?: boolean;
};

export const bannersApi = {
  list:    ()                          => api.get('/api/admin/banners'),
  create:  (data: unknown)             => api.post('/api/admin/banners', data),
  update:  (id: number, data: unknown) => api.put(`/api/admin/banners/${id}`, data),
  reorder: (items: { id: number; sort_order: number }[]) =>
    api.patch('/api/admin/banners/reorder', { items }),
  delete:  (id: number)                => api.delete(`/api/admin/banners/${id}`),
};

export const heroShotsApi = {
  list:   () => api.get<{ success: boolean; hero_shots: import('../types').HeroShot[] }>(
    '/api/admin/hero-shots',
  ),
  update: (slot: 0 | 1 | 2, data: { image_url?: string | null; caption?: string | null }) =>
    api.put<{ success: boolean; hero_shot: import('../types').HeroShot }>(
      `/api/admin/hero-shots/${slot}`,
      data,
    ),
};

export const testimonialsApi = {
  list:    ()                    => api.get('/api/admin/testimonials'),
  create:  (data: unknown)       => api.post('/api/admin/testimonials', data),
  bulk:    (items: TestimonialBulkItem[]) =>
    api.post<{ success: boolean; testimonials: unknown[] }>('/api/admin/testimonials/bulk', { items }),
  update:  (id: number, data: unknown) => api.put(`/api/admin/testimonials/${id}`, data),
  reorder: (items: { id: number; sort_order: number }[]) =>
    api.patch('/api/admin/testimonials/reorder', { items }),
  delete:  (id: number)          => api.delete(`/api/admin/testimonials/${id}`),
};
