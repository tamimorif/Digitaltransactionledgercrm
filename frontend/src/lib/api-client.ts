import axios from 'axios';

// Create axios instance
const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
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

// Response interceptor to handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 Unauthorized
    if (error.response?.status === 401) {
      // Only redirect if we have a stored token (meaning session expired)
      // Don't redirect during failed login attempts
      const hasToken = localStorage.getItem('auth_token');
      const isAuthPage = typeof window !== 'undefined' &&
        (window.location.pathname.includes('/login') ||
          window.location.pathname.includes('/register') ||
          window.location.pathname.includes('/verify-email'));

      const isAdminPage = typeof window !== 'undefined' &&
        window.location.pathname.includes('/admin');

      if (hasToken && !isAuthPage && !isAdminPage) {
        // Session expired - clear and redirect
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        localStorage.removeItem('tenant');
        window.location.href = '/login';
      } else if (hasToken && isAdminPage) {
        // On admin pages, just show error but don't auto-redirect
        console.warn('Session expired. Please log in again.');
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
