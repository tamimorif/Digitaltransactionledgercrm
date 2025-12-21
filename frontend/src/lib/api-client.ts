/**
 * UNIFIED API CLIENT
 * 
 * This is the single source of truth for API communication.
 * All API calls should use this client.
 * 
 * Features:
 * - Automatic token injection
 * - Token refresh on 401
 * - Rate limit handling with auto-retry
 * - Request queuing during token refresh
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL, STORAGE_KEYS } from './constants';

// =============================================================================
// Storage Helpers (centralized token management)
// =============================================================================

export const tokenStorage = {
  getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  },

  setAccessToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
  },

  getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  },

  setRefreshToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, token);
  },

  getUser<T = unknown>(): T | null {
    if (typeof window === 'undefined') return null;
    const user = localStorage.getItem(STORAGE_KEYS.USER);
    return user ? JSON.parse(user) : null;
  },

  setUser<T>(user: T): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  },

  getTenant<T = unknown>(): T | null {
    if (typeof window === 'undefined') return null;
    const tenant = localStorage.getItem(STORAGE_KEYS.TENANT);
    return tenant ? JSON.parse(tenant) : null;
  },

  setTenant<T>(tenant: T): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.TENANT, JSON.stringify(tenant));
  },

  clearAll(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.TENANT);
  },
};

// =============================================================================
// Axios Instance
// =============================================================================

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// =============================================================================
// Token Refresh Queue (prevents multiple simultaneous refresh attempts)
// =============================================================================

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: string | null) => void;
  reject: (reason: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// =============================================================================
// Helper Functions
// =============================================================================

function isAuthPage(): boolean {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname;
  return (
    path.includes('/login') ||
    path.includes('/register') ||
    path.includes('/verify-email') ||
    path.includes('/forgot-password') ||
    path.includes('/reset-password')
  );
}

function redirectToLogin(): void {
  if (typeof window !== 'undefined' && !isAuthPage()) {
    window.location.href = '/login';
  }
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
      refreshToken,
    });

    const { token, refreshToken: newRefreshToken } = response.data;

    tokenStorage.setAccessToken(token);
    if (newRefreshToken) {
      tokenStorage.setRefreshToken(newRefreshToken);
    }

    return token;
  } catch {
    return null;
  }
}

// =============================================================================
// Request Interceptor
// =============================================================================

apiClient.interceptors.request.use(
  (config) => {
    const token = tokenStorage.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// =============================================================================
// Response Interceptor
// =============================================================================

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Handle Network Error (Offline Mode)
    const isNetworkError =
      !error.response &&
      (error.message === 'Network Error' ||
        error.code === 'ERR_NETWORK' ||
        (typeof window !== 'undefined' && !window.navigator.onLine));

    if (isNetworkError) {
      const allowedMethods = ['post', 'put', 'delete', 'patch'];
      if (
        originalRequest &&
        allowedMethods.includes(originalRequest.method?.toLowerCase() || '')
      ) {
        // Queue the request
        try {
          const { QueueManager } = await import('./queue-manager');
          await QueueManager.enqueueRequest(originalRequest);

          // Return a mock success response to keep UI optimistic
          return Promise.resolve({
            data: { success: true, message: 'Offline: Request Queued' },
            status: 202,
            statusText: 'Accepted',
            headers: {},
            config: originalRequest,
          });
        } catch (queueError) {
          console.error('Failed to queue offline request', queueError);
        }
      }
    }

    // Handle 401 Unauthorized - Token expired
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      // Don't try to refresh on auth pages
      if (isAuthPage()) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue request while refresh is in progress
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (token) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const newToken = await refreshAccessToken();

        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
          processQueue(null, newToken);
          isRefreshing = false;
          return apiClient(originalRequest);
        } else {
          // Refresh failed
          processQueue(error, null);
          isRefreshing = false;
          tokenStorage.clearAll();
          redirectToLogin();
          return Promise.reject(error);
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        tokenStorage.clearAll();
        redirectToLogin();
        return Promise.reject(refreshError);
      }
    }

    // Handle 429 Too Many Requests - Rate limiting
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['x-ratelimit-reset'];
      const retryAfterMs = retryAfter
        ? parseInt(retryAfter) * 1000 - Date.now()
        : 5000;

      console.warn(`Rate limit exceeded. Retrying after ${retryAfterMs}ms`);

      // Dispatch custom event for UI notification
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('rate-limit-exceeded', {
            detail: {
              retryAfter: retryAfterMs,
              message: (error.response.data as { message?: string })?.message || 'Too many requests',
            },
          })
        );
      }

      // Auto-retry if reasonable wait time
      if (retryAfterMs > 0 && retryAfterMs < 30000 && originalRequest) {
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

// =============================================================================
// Exports
// =============================================================================

export default apiClient;

// Named export for explicit imports
export { apiClient };

// Re-export for backward compatibility during migration
export const storage = tokenStorage;
