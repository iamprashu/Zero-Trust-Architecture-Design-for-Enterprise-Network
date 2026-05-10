import axios from 'axios';
import { signRequest, generateSessionKeyPair, hasSessionKey } from './crypto';

const BANKING_URL = import.meta.env.VITE_BANKING_URL || '/api/banking';
const AUTH_URL = import.meta.env.VITE_AUTH_URL || '/api';

const api = axios.create({
  baseURL: BANKING_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// ── Request Interceptor ─────────────────────────────────────────────────────
// Attach JWT + cryptographic request signature before every request
api.interceptors.request.use(
  async (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Sign the request with the in-memory session key
    if (hasSessionKey()) {
      // Build full URL path to match what the server sees in req.originalUrl
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
  },
  (error) => Promise.reject(error)
);

// ── Response Interceptor ────────────────────────────────────────────────────
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 — try to refresh the token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      if (!window.isRefreshing) {
        window.isRefreshing = true;
        window.refreshSubscribers = window.refreshSubscribers || [];
        
        try {
          const refreshRes = await axios.post(
            `${AUTH_URL}/auth/refresh`,
            {},
            { withCredentials: true }
          );

          const newAccessToken = refreshRes.data?.accessToken;
          if (newAccessToken) {
            localStorage.setItem('accessToken', newAccessToken);
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          }

          window.isRefreshing = false;
          window.refreshSubscribers.forEach(cb => cb(newAccessToken));
          window.refreshSubscribers = [];

          return await api(originalRequest);
        } catch (refreshError) {
          window.isRefreshing = false;
          window.refreshSubscribers = [];
          localStorage.removeItem('accessToken');
          localStorage.removeItem('userInfo');
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      } else {
        return new Promise(resolve => {
          window.refreshSubscribers.push((token) => {
            if (token) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            resolve(api(originalRequest));
          });
        });
      }
    }

    // Handle 403 — session key required means page was refreshed
    if (error.response?.status === 403) {
      const code = error.response.data?.code;
      if (code === 'SESSION_KEY_REQUIRED' || code === 'SIGNATURE_INVALID' || code === 'TIMESTAMP_EXPIRED') {
        // Session key is gone (page refresh) — user must re-authenticate
        const event = new CustomEvent('session-expired', {
          detail: 'Your session key has expired. Please login again.'
        });
        window.dispatchEvent(event);
      } else {
        const event = new CustomEvent('restricted-access', {
          detail: error.response.data?.error || 'Unauthorized access'
        });
        window.dispatchEvent(event);
      }
    }

    throw new Error(error.response?.data?.error || 'API Error');
  }
);

// ── Session Key Initialization ──────────────────────────────────────────────
// Call this after successful login to generate and register the session key
export async function initializeSessionKey() {
  const publicKeyJWK = await generateSessionKeyPair();

  // Send the public key to the server
  const token = localStorage.getItem('accessToken');
  await axios.post(
    `${AUTH_URL}/auth/session-key`,
    { publicKeyJWK },
    {
      headers: { Authorization: `Bearer ${token}` },
      withCredentials: true
    }
  );

  return true;
}

// ── apiCall helper ──────────────────────────────────────────────────────────
export async function apiCall(endpoint, options = {}) {
  const axiosOptions = {
    url: endpoint,
    method: options.method || 'GET',
    data: options.body
      ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body)
      : undefined,
  };

  return await api(axiosOptions);
}

export default api;
