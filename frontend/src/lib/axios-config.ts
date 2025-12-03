import axios from 'axios';
import { authAPI, storage } from './auth-api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Flag to prevent multiple simultaneous refresh attempts
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

// Request interceptor - Add token to header
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token') || storage.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors and token refresh
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized - Token expired
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = storage.getRefreshToken();

      if (!refreshToken) {
        // No refresh token available - redirect to login
        processQueue(error, null);
        isRefreshing = false;
        redirectToLogin();
        return Promise.reject(error);
      }

      try {
        // Attempt to refresh the token
        const response = await authAPI.refreshToken(refreshToken);
        const newToken = response.token;
        const newRefreshToken = response.refreshToken;

        // Store new tokens
        storage.setToken(newToken);
        localStorage.setItem('auth_token', newToken);

        if (newRefreshToken) {
          storage.setRefreshToken(newRefreshToken);
        }

        // Update authorization header
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;

        // Process queued requests
        processQueue(null, newToken);
        isRefreshing = false;

        // Retry the original request
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed - clear tokens and redirect
        processQueue(refreshError, null);
        isRefreshing = false;
        storage.clear();
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        localStorage.removeItem('tenant');
        redirectToLogin();
        return Promise.reject(refreshError);
      }
    }

    // Handle 429 Too Many Requests - Rate limiting
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['x-ratelimit-reset'];
      const retryAfterMs = retryAfter
        ? (parseInt(retryAfter) * 1000 - Date.now())
        : 5000; // Default to 5 seconds

      console.warn(`Rate limit exceeded. Retrying after ${retryAfterMs}ms`);

      // Optionally show user notification
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('rate-limit-exceeded', {
          detail: {
            retryAfter: retryAfterMs,
            message: error.response.data?.message || 'Too many requests',
          },
        });
        window.dispatchEvent(event);
      }

      // Auto-retry after delay (optional - you may want to let user decide)
      if (retryAfterMs < 30000) { // Only auto-retry if less than 30 seconds
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(apiClient(originalRequest));
          }, retryAfterMs);
        });
      }
    }

    return Promise.reject(error);
  }
);

// Helper function to redirect to login
function redirectToLogin() {
  if (typeof window !== 'undefined') {
    const isAuthPage =
      window.location.pathname.includes('/login') ||
      window.location.pathname.includes('/register') ||
      window.location.pathname.includes('/verify-email');

    if (!isAuthPage) {
      window.location.href = '/login';
    }
  }
}

export default apiClient;
