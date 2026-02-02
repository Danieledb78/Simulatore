import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor per aggiungere token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor per gestire errori
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.put('/auth/change-password', { currentPassword, newPassword }),
};

// Dashboard
export const dashboardApi = {
  getOverview: () => api.get('/dashboard/overview'),
  getOrdersChart: (days: number) => api.get(`/dashboard/orders-chart?days=${days}`),
  getTopProducts: (limit: number) => api.get(`/dashboard/top-products?limit=${limit}`),
  getTopCustomers: (limit: number) => api.get(`/dashboard/top-customers?limit=${limit}`),
  getRecentOrders: (limit: number) => api.get(`/dashboard/recent-orders?limit=${limit}`),
  getDriversStatus: () => api.get('/dashboard/drivers-status'),
  getNotifications: () => api.get('/dashboard/notifications'),
};

// Products
export const productsApi = {
  getAll: (params?: any) => api.get('/products', { params }),
  getById: (id: string) => api.get(`/products/${id}`),
  getByBarcode: (barcode: string) => api.get(`/products/barcode/${barcode}`),
  create: (data: any) => api.post('/products', data),
  update: (id: string, data: any) => api.put(`/products/${id}`, data),
  delete: (id: string) => api.delete(`/products/${id}`),
};

// Categories
export const categoriesApi = {
  getAll: () => api.get('/categories'),
  create: (data: any) => api.post('/categories', data),
  update: (id: string, data: any) => api.put(`/categories/${id}`, data),
  delete: (id: string) => api.delete(`/categories/${id}`),
};

// Inventory
export const inventoryApi = {
  getAll: (params?: any) => api.get('/inventory', { params }),
  getLowStock: () => api.get('/inventory/low-stock'),
  getMovements: (params?: any) => api.get('/inventory/movements', { params }),
  loadStock: (data: any) => api.post('/inventory/load', data),
  loadBatch: (data: any) => api.post('/inventory/load-batch', data),
  adjust: (data: any) => api.post('/inventory/adjust', data),
  checkAvailability: (items: any[]) => api.post('/inventory/check-availability', { items }),
};

// Customers
export const customersApi = {
  getAll: (params?: any) => api.get('/customers', { params }),
  getById: (id: string) => api.get(`/customers/${id}`),
  getOrders: (id: string) => api.get(`/customers/${id}/orders`),
  create: (data: any) => api.post('/customers', data),
  update: (id: string, data: any) => api.put(`/customers/${id}`, data),
  delete: (id: string) => api.delete(`/customers/${id}`),
};

// Orders
export const ordersApi = {
  getAll: (params?: any) => api.get('/orders', { params }),
  getById: (id: string) => api.get(`/orders/${id}`),
  getStats: (period: string) => api.get(`/orders/stats?period=${period}`),
  create: (data: any) => api.post('/orders', data),
  updateStatus: (id: string, status: string, notes?: string) =>
    api.put(`/orders/${id}/status`, { status, notes }),
  assignDriver: (id: string, driverId: string) =>
    api.post(`/orders/${id}/assign-driver`, { driverId }),
  autoAssign: (id: string) => api.post(`/orders/${id}/auto-assign`),
  getPaymentLink: (id: string) => api.post(`/orders/${id}/payment-link`),
};

// Drivers
export const driversApi = {
  getAll: () => api.get('/drivers'),
  getById: (id: string) => api.get(`/drivers/${id}`),
  create: (data: any) => api.post('/drivers', data),
  update: (id: string, data: any) => api.put(`/drivers/${id}`, data),
  updateAvailability: (id: string, isAvailable: boolean) =>
    api.put(`/drivers/${id}/availability`, { isAvailable }),
  delete: (id: string) => api.delete(`/drivers/${id}`),
};

// Zones
export const zonesApi = {
  getAll: () => api.get('/zones'),
  getById: (id: string) => api.get(`/zones/${id}`),
  create: (data: any) => api.post('/zones', data),
  update: (id: string, data: any) => api.put(`/zones/${id}`, data),
  delete: (id: string) => api.delete(`/zones/${id}`),
};

// Payments
export const paymentsApi = {
  getAll: (params?: any) => api.get('/payments', { params }),
  createIntent: (data: any) => api.post('/payments/create-intent', data),
  createPaymentLink: (data: any) => api.post('/payments/create-payment-link', data),
  recordManual: (data: any) => api.post('/payments/record-manual', data),
  refund: (id: string, data?: any) => api.post(`/payments/${id}/refund`, data),
};

// Invoices
export const invoicesApi = {
  getAll: (params?: any) => api.get('/invoices', { params }),
  getById: (id: string) => api.get(`/invoices/${id}`),
  create: (data: any) => api.post('/invoices', data),
  issue: (id: string) => api.post(`/invoices/${id}/issue`),
  send: (id: string, via: string) => api.post(`/invoices/${id}/send`, { via }),
  downloadPdf: (id: string) => api.get(`/invoices/${id}/pdf`, { responseType: 'blob' }),
};

// Settings
export const settingsApi = {
  getAll: () => api.get('/settings'),
  get: (key: string) => api.get(`/settings/${key}`),
  update: (key: string, value: any) => api.put(`/settings/${key}`, { value }),
  updateBulk: (settings: any) => api.put('/settings', settings),
  getPriceLists: () => api.get('/settings/price-lists/all'),
  createPriceList: (data: any) => api.post('/settings/price-lists', data),
  getSuppliers: () => api.get('/settings/suppliers/all'),
  createSupplier: (data: any) => api.post('/settings/suppliers', data),
};

export default api;
