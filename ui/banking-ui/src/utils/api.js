import axios from 'axios';
import fpPromise from '@fingerprintjs/fingerprintjs';

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

let fpPromiseCache = fpPromise.load();
let deviceId = getCookie('deviceId');

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
// Attach accessToken from localStorage as Authorization header before every request
api.interceptors.request.use(
  async (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    let storedDeviceId = getCookie('deviceId') || deviceId;
    
    if (!storedDeviceId) {
      try {
        const fp = await fpPromiseCache;
        const result = await fp.get();
        storedDeviceId = result.visitorId;
        deviceId = storedDeviceId;
        document.cookie = `deviceId=${storedDeviceId}; path=/; max-age=31536000`;
      } catch (e) {
        console.error("Fingerprint error", e);
      }
    }

    if (storedDeviceId) {
      config.headers['X-Device-Id'] = storedDeviceId;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response Interceptor ────────────────────────────────────────────────────
// Unwrap response data; on 401 try to refresh the token once, then retry
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        // refreshToken is stored in an HttpOnly cookie; withCredentials sends it automatically
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

        // Retry original request — response.data is unwrapped by the success handler
        return await api(originalRequest);
      } catch (refreshError) {
        // Refresh failed — clear local auth and redirect to login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('userInfo');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    if (error.response?.status === 403) {
      if (error.response.data?.code === 'DEVICE_UNRECOGNIZED' || error.response.data?.code === 'DEVICE_EXPIRED') {
        const event = new CustomEvent('device_unrecognized', {
          detail: { 
            isFirstLogin: error.response.data?.isFirstLogin,
            code: error.response.data?.code
          }
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

// ── apiCall helper ──────────────────────────────────────────────────────────
// Thin wrapper that accepts fetch-style options for backward compatibility
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
