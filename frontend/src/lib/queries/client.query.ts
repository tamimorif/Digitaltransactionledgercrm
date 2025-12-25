import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosInstance from '../axios-config';
import type {
  Client,
  CreateClientRequest,
  UpdateClientRequest,
  ClientWithTransactions,
  Transaction,
  CreateTransactionRequest,
  UpdateTransactionRequest,
} from '../models/client.model';

// ==================== Client Queries ====================

export function useGetClients() {
  return useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: async () => {
      const response = await axiosInstance.get('/clients');
      return response.data;
    },
  });
}

export function useGetClient(clientId: number) {
  return useQuery<ClientWithTransactions>({
    queryKey: ['client', clientId],
    queryFn: async () => {
      const response = await axiosInstance.get(`/clients/${clientId}`);
      return response.data;
    },
    enabled: !!clientId,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateClientRequest) => {
      const response = await axiosInstance.post('/clients', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

export function useUpdateClient(clientId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateClientRequest) => {
      const response = await axiosInstance.put(`/clients/${clientId}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client', clientId] });
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (clientId: number) => {
      await axiosInstance.delete(`/clients/${clientId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

// ==================== Transaction Queries ====================

export function useGetTransactions(
  clientId?: string | number,
  filters?: { startDate?: string; endDate?: string },
  branchId?: string
) {
  return useQuery<Transaction[]>({
    queryKey: clientId
      ? ['transactions', clientId, filters, branchId]
      : ['transactions', filters, branchId],
    queryFn: async () => {
      const url = clientId ? `/clients/${clientId}/transactions` : '/transactions';
      const params = new URLSearchParams();

      if (filters?.startDate) {
        params.append('startDate', filters.startDate);
      }
      if (filters?.endDate) {
        params.append('endDate', filters.endDate);
      }
      if (branchId && branchId !== 'all') {
        params.append('branchId', branchId);
      }

      const queryString = params.toString();
      const fullUrl = queryString ? `${url}?${queryString}` : url;

      const response = await axiosInstance.get(fullUrl);
      return response.data;
    },
    enabled: clientId ? !!clientId : true,
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateTransactionRequest) => {
      const response = await axiosInstance.post('/transactions', data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['recent-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions', variables.clientId] });

      queryClient.invalidateQueries({ queryKey: ['client', variables.clientId] });
    },
  });
}

export function useUpdateTransaction(transactionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateTransactionRequest) => {
      const response = await axiosInstance.put(`/transactions/${transactionId}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['recent-transactions'] });
    },

  });
}

export function useCancelTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ transactionId, reason }: { transactionId: string; reason: string }) => {
      const response = await axiosInstance.post(`/transactions/${transactionId}/cancel`, { reason });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['recent-transactions'] });
    },

  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (transactionId: string) => {
      await axiosInstance.delete(`/transactions/${transactionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['recent-transactions'] });
    },

  });
}

// ==================== Payment Queries ====================

export function useCreatePayment(transactionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      amount: number;
      currency: string;
      exchangeRate: number;
      notes?: string;
      paymentMethod?: string;
    }) => {
      const response = await axiosInstance.post(`/transactions/${transactionId}/payments`, data);
      return response.data;
    },
    onSuccess: (_, __, context) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['payments', transactionId] });
    },
  });
}

export function useGetPayments(transactionId: string) {
  return useQuery({
    queryKey: ['payments', transactionId],
    queryFn: async () => {
      const response = await axiosInstance.get(`/transactions/${transactionId}/payments`);
      return response.data;
    },
    enabled: !!transactionId,
  });
}
