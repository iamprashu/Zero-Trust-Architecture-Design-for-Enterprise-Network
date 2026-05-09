import axios from 'axios';
import { signRequest, hasSessionKey } from './crypto';

const AUTH_BASE = import.meta.env.VITE_AUTH_URL || '';

const api = axios.create({
  baseURL: `${AUTH_BASE}/api`,
  withCredentials: true,
});

// ── Request Interceptor ─────────────────────────────────────────────────────
api.interceptors.request.use(async (config) => {
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Sign the request with the in-memory session key
  if (hasSessionKey()) {
    const base = (config.baseURL || '').replace(/\/$/, '');
    const path = config.url || '';
    const fullUrl = path.startsWith('/') ? base + path : base + '/' + path;
    const method = (config.method || 'GET').toUpperCase();
    const body = config.data || null;

    const sig = await signRequest(method, fullUrl, body);
    if (sig) {
      config.headers['X-Signature'] = sig.signature;
      config.headers['X-Timestamp'] = sig.timestamp;
    }
  }

  return config;
});

// ── Response Interceptor ────────────────────────────────────────────────────
api.interceptors.response.use(
  (response) => {
    return {
      ok: true,
      status: response.status,
      json: async () => response.data,
      data: response.data
    };
  },
  async (error) => {
    const originalRequest = error.config;
    
    // 401 — try refresh
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        await axios.post(`${AUTH_BASE}/api/auth/refresh`, {}, { withCredentials: true });
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('user');
        window.location.href = '/admin/login';
        return Promise.reject(refreshError);
      }
    }
    
    // 403 — session key issues
    if (error.response && error.response.status === 403) {
      const code = error.response.data?.code;
      if (code === 'SESSION_KEY_REQUIRED' || code === 'SIGNATURE_INVALID' || code === 'TIMESTAMP_EXPIRED') {
        window.dispatchEvent(new CustomEvent('session-expired', {
          detail: 'Session key expired. Please login again.'
        }));
      }
    }

    if (error.response) {
       return {
         ok: false,
         status: error.response.status,
         json: async () => error.response.data,
         error: error.response.data
       };
    }
    
    return Promise.reject(error);
  }
);

export const fetchWithAxios = async (url, options = {}) => {
  const axiosConfig = {
    url,
    method: options.method || 'GET',
    data: options.body ? JSON.parse(options.body) : undefined,
    headers: options.headers || {}
  };
  
  if (axiosConfig.url.startsWith('/api')) {
    axiosConfig.url = axiosConfig.url.replace('/api', '');
  }

  return await api(axiosConfig);
};

export default api;
