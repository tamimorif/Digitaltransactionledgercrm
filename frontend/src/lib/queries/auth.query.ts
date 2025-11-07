import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../axios-config';
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
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
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
      // ذخیره token و user در localStorage
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      // Update cache
      queryClient.setQueryData(['user'], data.user);
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
    enabled: enabled && !!localStorage.getItem('auth_token'),
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
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('auth_token');
};

export const getStoredUser = () => {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};
