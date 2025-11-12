import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor - اضافه کردن token به header
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - مدیریت خطاها
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Only redirect to login if we're not already on auth pages and we have a token stored
      // This prevents redirect during failed login attempts
      const hasToken = localStorage.getItem('auth_token');
      const isAuthPage = typeof window !== 'undefined' &&
        (window.location.pathname.includes('/login') ||
          window.location.pathname.includes('/register') ||
          window.location.pathname.includes('/verify-email'));

      if (hasToken && !isAuthPage) {
        // Token expired - clear and redirect to login
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        localStorage.removeItem('tenant');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
