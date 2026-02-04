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

export default api;

