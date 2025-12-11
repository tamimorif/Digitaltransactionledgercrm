import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../axios-config';
import { Transfer, CreateTransferRequest } from '../models/transfer.model';

// Fetch transfers
export const useGetTransfers = (branchId?: number, status?: string) => {
    return useQuery({
        queryKey: ['transfers', branchId, status],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (branchId) params.append('branchId', branchId.toString());
            if (status) params.append('status', status);

            const response = await apiClient.get<Transfer[]>(`/transfers?${params.toString()}`);
            return response.data;
        },
    });
};

// Create transfer
export const useCreateTransfer = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: CreateTransferRequest) => {
            const response = await apiClient.post<Transfer>('/transfers', data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['transfers'] });
            queryClient.invalidateQueries({ queryKey: ['cash-balances'] }); // Update balances
        },
    });
};

// Accept transfer
export const useAcceptTransfer = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: number) => {
            const response = await apiClient.post<Transfer>(`/transfers/${id}/accept`);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['transfers'] });
            queryClient.invalidateQueries({ queryKey: ['cash-balances'] });
        },
    });
};

// Cancel transfer
export const useCancelTransfer = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: number) => {
            const response = await apiClient.post<Transfer>(`/transfers/${id}/cancel`);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['transfers'] });
            queryClient.invalidateQueries({ queryKey: ['cash-balances'] });
        },
    });
};
