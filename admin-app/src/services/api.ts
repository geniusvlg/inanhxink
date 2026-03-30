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
  list:   (type: string)              => api.get('/api/admin/products', { params: { type } }),
  create: (data: unknown)             => api.post('/api/admin/products', data),
  update: (id: number, data: unknown) => api.put(`/api/admin/products/${id}`, data),
  delete: (id: number)                => api.delete(`/api/admin/products/${id}`),
};

export const productCategoriesApi = {
  list:   (type?: string) => api.get('/api/admin/product-categories', { params: type ? { type } : {} }),
  create: (data: unknown) => api.post('/api/admin/product-categories', data),
  delete: (id: number)    => api.delete(`/api/admin/product-categories/${id}`),
};

export const uploadApi = {
  images: (files: File[], folder = 'product-new') => {
    const form = new FormData();
    files.forEach(f => form.append('files', f));
    return api.post<{ success: boolean; urls: string[] }>(
      `/api/upload?prefix=products/${folder}`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  },
};
