import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient, { tokenStorage } from '../api-client';
import {
  RegisterRequest,
  RegisterResponse,
  VerifyEmailRequest,
  VerifyEmailResponse,
  LoginRequest,
  LoginResponse,
  ResendCodeRequest,
  GetMeResponse,
} from '../models/auth.model';

// ==================== API Functions ====================

const authApi = {
  register: async (data: RegisterRequest): Promise<RegisterResponse> => {
    const response = await apiClient.post('/auth/register', data);
    return response.data;
  },

  verifyEmail: async (data: VerifyEmailRequest): Promise<VerifyEmailResponse> => {
    const response = await apiClient.post('/auth/verify-email', data);
    return response.data;
  },

  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post('/auth/login', data);
    return response.data;
  },

  resendCode: async (data: ResendCodeRequest): Promise<{ message: string }> => {
    const response = await apiClient.post('/auth/resend-code', data);
    return response.data;
  },

  getMe: async (): Promise<GetMeResponse> => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },

  logout: () => {
    tokenStorage.clearAll();
  },
};

// ==================== React Query Hooks ====================

export const useRegister = () => {
  return useMutation({
    mutationFn: authApi.register,
    onSuccess: (data) => {
      console.log('Registration successful:', data);
    },
  });
};

export const useVerifyEmail = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authApi.verifyEmail,
    onSuccess: () => {
      // Invalidate user queries after successful verification
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });
};

export const useLogin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      // Store token and user in localStorage (SSR-safe)
      tokenStorage.setAccessToken(data.token);
      tokenStorage.setUser(data.user);

      // Update cache
      queryClient.setQueryData(['user', 'me'], data.user);
    },
  });
};

export const useResendCode = () => {
  return useMutation({
    mutationFn: authApi.resendCode,
  });
};

export const useGetMe = (enabled = true) => {
  return useQuery({
    queryKey: ['user', 'me'],
    queryFn: authApi.getMe,
    enabled: enabled,
    retry: false,
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      authApi.logout();
    },
    onSuccess: () => {
      queryClient.clear();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    },
  });
};

// ==================== Helper Functions ====================

export const isAuthenticated = (): boolean => {
  return !!tokenStorage.getAccessToken();
};

export const getStoredUser = () => {
  return tokenStorage.getUser();
};
