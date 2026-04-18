import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  withCredentials: true, // important for cookies
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
        await axios.post('http://localhost:5000/api/auth/refresh', {}, { withCredentials: true });
        
        // Retry the original failed request
        return api(originalRequest);
      } catch (refreshError) {
        // If refresh fails too, they must re-login
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
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
