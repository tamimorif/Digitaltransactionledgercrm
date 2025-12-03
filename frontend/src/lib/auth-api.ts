// API client for backend communication


const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';

// Types
export interface User {
  id: number;
  email: string;
  role: string;
  tenantId?: number;
  primaryBranchId?: number;
  primaryBranch?: {
    id: number;
    name: string;
  };
  status: string;
  trialEndsAt?: string;
  licenseActivatedAt?: string | null;
  emailVerified: boolean;
}

export interface Tenant {
  id: number;
  name: string;
  status: string;
  userLimit: number;
}

export interface LoginResponse {
  message: string;
  token: string;
  refreshToken?: string;
  user: User;
  tenant?: Tenant;
}

export interface RegisterResponse {
  message: string;
  user: User;
}

// Auth API
export const authAPI = {
  async register(email: string, password: string, name: string): Promise<RegisterResponse> {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Registration failed');
    }

    return res.json();
  },

  async verifyEmail(email: string, code: string): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE_URL}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Verification failed');
    }

    return res.json();
  },

  async resendCode(email: string): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE_URL}/auth/resend-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to resend code');
    }

    return res.json();
  },

  async login(email: string, password: string): Promise<LoginResponse> {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Login failed');
    }

    return res.json();
  },

  async getMe(token: string): Promise<User> {
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error('Failed to get user info');
    }

    return res.json();
  },

  async refreshToken(refreshToken: string): Promise<LoginResponse> {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Token refresh failed');
    }

    return res.json();
  },

  async logout(refreshToken: string): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Logout failed');
    }

    return res.json();
  },
};

// License API
export const licenseAPI = {
  async activateLicense(token: string, licenseKey: string): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE_URL}/licenses/activate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ licenseKey }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'License activation failed');
    }

    return res.json();
  },

  async getLicenseStatus(token: string) {
    const res = await fetch(`${API_BASE_URL}/licenses/status`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error('Failed to get license status');
    }

    return res.json();
  },
};

// Storage helpers
export const storage = {
  setToken(token: string) {
    localStorage.setItem('token', token);
  },

  getToken(): string | null {
    return localStorage.getItem('token');
  },

  removeToken() {
    localStorage.removeItem('token');
  },

  setRefreshToken(refreshToken: string) {
    localStorage.setItem('refreshToken', refreshToken);
  },

  getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  },

  removeRefreshToken() {
    localStorage.removeItem('refreshToken');
  },

  setUser(user: User) {
    localStorage.setItem('user', JSON.stringify(user));
  },

  getUser(): User | null {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  removeUser() {
    localStorage.removeItem('user');
  },

  clear() {
    this.removeToken();
    this.removeRefreshToken();
    this.removeUser();
  },
};
