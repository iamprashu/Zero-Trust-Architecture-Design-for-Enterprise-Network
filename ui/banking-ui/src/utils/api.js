import axios from 'axios';

const BANKING_URL = 'http://localhost:5001/api';
const AUTH_URL = 'http://localhost:5000/api';

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
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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
      const event = new CustomEvent('restricted-access', {
        detail: error.response.data?.error || 'Unauthorized access'
      });
      window.dispatchEvent(event);
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
