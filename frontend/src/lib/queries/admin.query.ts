import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../axios-config';
import { Tenant, DashboardStats } from '../models/admin.model';
import { User } from '../models/auth.model';

// ==================== API Functions ====================

const adminApi = {
  getAllTenants: async (): Promise<Tenant[]> => {
    const response = await apiClient.get('/admin/tenants');
    return response.data;
  },

  getTenantById: async (tenantId: number): Promise<Tenant> => {
    const response = await apiClient.get(`/admin/tenants/${tenantId}`);
    return response.data;
  },

  suspendTenant: async (tenantId: number): Promise<{ message: string }> => {
    const response = await apiClient.post(`/admin/tenants/${tenantId}/suspend`);
    return response.data;
  },

  activateTenant: async (tenantId: number): Promise<{ message: string }> => {
    const response = await apiClient.post(`/admin/tenants/${tenantId}/activate`);
    return response.data;
  },

  getAllUsers: async (): Promise<User[]> => {
    const response = await apiClient.get('/admin/users');
    return response.data;
  },

  getDashboardStats: async (): Promise<DashboardStats> => {
    const response = await apiClient.get('/admin/dashboard/stats');
    return response.data;
  },
};

// ==================== React Query Hooks ====================

export const useGetAllTenants = (enabled = true) => {
  return useQuery({
    queryKey: ['admin', 'tenants'],
    queryFn: adminApi.getAllTenants,
    enabled,
  });
};

export const useGetTenantById = (tenantId: number, enabled = true) => {
  return useQuery({
    queryKey: ['admin', 'tenant', tenantId],
    queryFn: () => adminApi.getTenantById(tenantId),
    enabled: enabled && !!tenantId,
  });
};

export const useSuspendTenant = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: adminApi.suspendTenant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tenants'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });
};

export const useActivateTenant = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: adminApi.activateTenant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tenants'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });
};

export const useGetAllUsers = (enabled = true) => {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: adminApi.getAllUsers,
    enabled,
  });
};

export const useGetDashboardStats = (enabled = true) => {
  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: adminApi.getDashboardStats,
    enabled,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
};
