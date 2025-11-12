import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/src/lib/api-client';
import type {
  License,
  GenerateLicenseRequest,
  ActivateLicenseRequest,
  LicenseStatusResponse,
} from '@/src/models/license.model';

// Query Keys
export const licenseKeys = {
  all: ['licenses'] as const,
  status: () => [...licenseKeys.all, 'status'] as const,
  list: () => [...licenseKeys.all, 'list'] as const,
};

// API Functions
const licenseApi = {
  activateLicense: async (data: ActivateLicenseRequest): Promise<{ message: string }> => {
    const response = await apiClient.post('/licenses/activate', data);
    return response.data;
  },

  getLicenseStatus: async (): Promise<LicenseStatusResponse> => {
    const response = await apiClient.get('/licenses/status');
    return response.data;
  },

  getMyLicenses: async (): Promise<{
    licenses: License[];
    totalUserLimit: number;
    currentUserCount: number;
  }> => {
    const response = await apiClient.get('/licenses/my-licenses');
    return response.data;
  },

  // SuperAdmin only
  generateLicense: async (data: GenerateLicenseRequest): Promise<License> => {
    const response = await apiClient.post('/admin/licenses/generate', data);
    return response.data;
  },

  getAllLicenses: async (): Promise<License[]> => {
    const response = await apiClient.get('/admin/licenses');
    return response.data;
  },

  revokeLicense: async (licenseId: number): Promise<{ message: string }> => {
    const response = await apiClient.post(`/admin/licenses/${licenseId}/revoke`);
    return response.data;
  },
};

// Hooks

export function useActivateLicense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: licenseApi.activateLicense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: licenseKeys.status() });
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

export function useGetLicenseStatus() {
  return useQuery({
    queryKey: licenseKeys.status(),
    queryFn: licenseApi.getLicenseStatus,
    enabled: typeof window !== 'undefined' && !!localStorage.getItem('auth_token'),
  });
}

export function useGetMyLicenses() {
  return useQuery({
    queryKey: [...licenseKeys.all, 'my-licenses'],
    queryFn: licenseApi.getMyLicenses,
    enabled: typeof window !== 'undefined' && !!localStorage.getItem('auth_token'),
  });
}

// SuperAdmin Hooks

export function useGenerateLicense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: licenseApi.generateLicense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: licenseKeys.list() });
    },
  });
}

export function useGetAllLicenses() {
  return useQuery({
    queryKey: licenseKeys.list(),
    queryFn: licenseApi.getAllLicenses,
  });
}

export function useRevokeLicense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: licenseApi.revokeLicense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: licenseKeys.list() });
    },
  });
}
