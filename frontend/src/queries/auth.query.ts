import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/src/lib/api-client';
import type {
  RegisterRequest,
  RegisterResponse,
  VerifyEmailRequest,
  VerifyEmailResponse,
  ResendCodeRequest,
  LoginRequest,
  LoginResponse,
  User,
} from '@/src/models/auth.model';

// Query Keys
export const authKeys = {
  all: ['auth'] as const,
  me: () => [...authKeys.all, 'me'] as const,
};

// API Functions
const authApi = {
  register: async (data: RegisterRequest): Promise<RegisterResponse> => {
    const response = await apiClient.post('/auth/register', data);
    return response.data;
  },

  verifyEmail: async (data: VerifyEmailRequest): Promise<VerifyEmailResponse> => {
    const response = await apiClient.post('/auth/verify-email', data);
    return response.data;
  },

  resendCode: async (data: ResendCodeRequest): Promise<{ message: string }> => {
    const response = await apiClient.post('/auth/resend-code', data);
    return response.data;
  },

  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post('/auth/login', data);
    return response.data;
  },

  getMe: async (): Promise<User> => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },
};

// Hooks

export function useRegister() {
  return useMutation({
    mutationFn: authApi.register,
    onSuccess: (data) => {
      // Optionally store email for verification step
      if (typeof window !== 'undefined') {
        localStorage.setItem('pending_email', data.user.email);
      }
    },
  });
}

export function useVerifyEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authApi.verifyEmail,
    onSuccess: () => {
      // Clear pending email
      if (typeof window !== 'undefined') {
        localStorage.removeItem('pending_email');
      }
    },
  });
}

export function useResendCode() {
  return useMutation({
    mutationFn: authApi.resendCode,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      // Store token and user data
      if (typeof window !== 'undefined') {
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        if (data.tenant) {
          localStorage.setItem('tenant', JSON.stringify(data.tenant));
        }
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: authKeys.all });
    },
  });
}

export function useGetMe() {
  return useQuery({
    queryKey: authKeys.me(),
    queryFn: authApi.getMe,
    enabled: typeof window !== 'undefined' && !!localStorage.getItem('auth_token'),
    retry: false,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return () => {
    // Clear storage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      localStorage.removeItem('tenant');
    }

    // Clear all queries
    queryClient.clear();

    // Redirect to login
    if (typeof window !== 'undefined') {
      window.location.href = '/auth/login';
    }
  };
}
