import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../axios-config';
import {
  GenerateLicenseRequest,
  ActivateLicenseRequest,
  License,
  LicenseStatusResponse,
  ActivateLicenseResponse,
} from '../models/license.model';

// ==================== API Functions ====================

const licenseApi = {
  generateLicense: async (data: GenerateLicenseRequest): Promise<License> => {
    const response = await apiClient.post('/admin/licenses/generate', data);
    return response.data;
  },

  activateLicense: async (data: ActivateLicenseRequest): Promise<ActivateLicenseResponse> => {
    const response = await apiClient.post('/licenses/activate', data);
    return response.data;
  },

  getLicenseStatus: async (): Promise<LicenseStatusResponse> => {
    const response = await apiClient.get('/licenses/status');
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

// ==================== React Query Hooks ====================

export const useGenerateLicense = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: licenseApi.generateLicense,
    onSuccess: () => {
      // Invalidate licenses list
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
    },
  });
};

export const useActivateLicense = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: licenseApi.activateLicense,
    onSuccess: () => {
      // Invalidate license status and user data
      queryClient.invalidateQueries({ queryKey: ['license', 'status'] });
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });
};

export const useGetLicenseStatus = (enabled = true) => {
  return useQuery({
    queryKey: ['license', 'status'],
    queryFn: licenseApi.getLicenseStatus,
    enabled,
  });
};

export const useGetAllLicenses = (enabled = true) => {
  return useQuery({
    queryKey: ['licenses'],
    queryFn: licenseApi.getAllLicenses,
    enabled,
  });
};

export const useRevokeLicense = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: licenseApi.revokeLicense,
    onSuccess: () => {
      // Invalidate licenses list
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
    },
  });
};
