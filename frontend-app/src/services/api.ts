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
  return response.data.data as Record<string, string>;
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
  type: 'thiep' | 'khung_anh' | 'so_scrapbook';
  categories: { id: number; name: string }[];
  is_active: boolean;
  created_at: string;
}

export interface ProductFilters {
  type?: 'thiep' | 'khung_anh' | 'so_scrapbook';
  category_ids?: string; // comma-separated ids, e.g. "1,2,3"
  min_price?: number;
  max_price?: number;
  sort?: 'newest' | 'price_asc' | 'price_desc';
}

export const getProducts = async (filters: ProductFilters = {}): Promise<Product[]> => {
  const params: Record<string, string | number> = {};
  if (filters.type)         params.type         = filters.type;
  if (filters.category_ids) params.category_ids = filters.category_ids;
  if (filters.min_price != null && filters.min_price !== 0) params.min_price = filters.min_price;
  if (filters.max_price != null) params.max_price = filters.max_price;
  if (filters.sort && filters.sort !== 'newest') params.sort = filters.sort;
  const response = await api.get<{ success: boolean; products: Product[] }>('/api/products', { params });
  return response.data.products ?? [];
};

export const getProductById = async (id: number): Promise<Product> => {
  const response = await api.get<{ success: boolean; product: Product }>(`/api/products/${id}`);
  return response.data.product;
};

export const getCategories = async (): Promise<{ id: number; name: string }[]> => {
  const response = await api.get<{ success: boolean; categories: { id: number; name: string }[] }>('/api/categories');
  return response.data.categories ?? [];
};

export default api;

