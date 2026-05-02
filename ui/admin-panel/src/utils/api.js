import axios from 'axios';
import fpPromise from '@fingerprintjs/fingerprintjs';

let fpPromiseCache = fpPromise.load();
let deviceId = localStorage.getItem('deviceId');

const AUTH_BASE = import.meta.env.VITE_AUTH_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: `${AUTH_BASE}/api`,
  withCredentials: true, // important for cookies
});

// Request Interceptor to add Device ID
api.interceptors.request.use(async (config) => {
  let storedDeviceId = localStorage.getItem('deviceId') || deviceId;
  
  if (!storedDeviceId) {
    try {
      const fp = await fpPromiseCache;
      const result = await fp.get();
      storedDeviceId = result.visitorId;
      deviceId = storedDeviceId;
      localStorage.setItem('deviceId', storedDeviceId);
    } catch (e) {
      console.error("Fingerprint error", e);
    }
  }

  if (storedDeviceId) {
    config.headers['X-Device-Id'] = storedDeviceId;
  }
  
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response Interceptor
api.interceptors.response.use(
  (response) => {
    // Return a fetch-like response object for backward compatibility
    return {
      ok: true,
      status: response.status,
      json: async () => response.data,
      data: response.data
    };
  },
  async (error) => {
    const originalRequest = error.config;
    
    // Catch 401 Unauthorized for token refresh
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        // Automatically attempt to refresh the token using the HttpOnly cookie
        await axios.post(`${AUTH_BASE}/api/auth/refresh`, {}, { withCredentials: true });
        
        // Retry the original failed request
        return api(originalRequest);
      } catch (refreshError) {
        // If refresh fails too, they must re-login
        localStorage.removeItem('adminToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    // Handle Device Errors
    if (error.response && error.response.status === 403) {
      if (error.response.data.code === 'DEVICE_UNRECOGNIZED' || error.response.data.code === 'DEVICE_EXPIRED') {
        // Dispatch custom event for App.jsx to pick up
        window.dispatchEvent(new CustomEvent('device_unrecognized', { 
          detail: { 
            isFirstLogin: error.response.data.isFirstLogin,
            code: error.response.data.code
          } 
        }));
        // We reject the promise, the UI will wait for OTP verification
      }
    }

    // Return a fetch-like error response object for backward compatibility
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
    // Add default headers unless overridden
    headers: options.headers || {}
  };
  
  // Clean up url if it contains baseURL
  if (axiosConfig.url.startsWith('http://localhost:5000/api')) {
    axiosConfig.url = axiosConfig.url.replace('http://localhost:5000/api', '');
  }

  // The interceptor wraps the return as { ok, json() }
  return await api(axiosConfig);
};

export default api;
